import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every user's Rates balance (zero-defaulted for users who
// have never been adjusted). No automated flow credits these yet — see
// Finance.prisma's module comment.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      creatorRateAccount: true,
      displayName: true,
      email: true,
      id: true,
      image: true,
      name: true,
    },
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
      : undefined,
  });

  const accounts = users.map((u) => ({
    available: u.creatorRateAccount?.available ?? 0,
    email: u.email,
    hasAccount: u.creatorRateAccount != null,
    image: u.image,
    lifetime: u.creatorRateAccount?.lifetime ?? 0,
    name: u.displayName || u.name,
    pending: u.creatorRateAccount?.pending ?? 0,
    referral: u.creatorRateAccount?.referral ?? 0,
    tier: u.creatorRateAccount?.tier ?? "Standard",
    userId: u.id,
  }));

  return NextResponse.json({ accounts });
});

const adjustSchema = z
  .object({
    userId: z.string().trim().min(1),
    action: z.enum([
      "grant",
      "set-tier",
      "reset-pending",
      "reset-available",
      "transfer-pending-to-available",
      "adjust",
    ]),
    field: z.enum(["pending", "available"]).optional(),
    direction: z.enum(["add", "deduct"]).optional(),
    amount: z.number().int().positive().optional(),
    tier: z.enum(["Standard", "Pro"]).optional(),
  })
  .strict()
  .refine(
    (v) => v.action !== "adjust" || (v.field && v.direction && v.amount),
    { message: "field, direction, and amount are required for adjust" },
  )
  .refine((v) => v.action !== "set-tier" || v.tier, {
    message: "tier is required for set-tier",
  });

export const PATCH = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = adjustSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { userId, action } = parsed.data;
  const user = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: userId },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found", message: "No such user." }, { status: 404 });
  }
  const userName = user.displayName || user.name;

  // Set tier: doesn't grant access on its own — an admin picking a tier for
  // someone who was never granted access would silently create an account
  // with a balance, which reads as "they're a creator now" without the
  // notification that actually says so.
  if (action === "set-tier") {
    const existing = await prisma.creatorRateAccount.findUnique({ where: { userId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Invalid request", message: "Grant artist access before setting a tier." },
        { status: 400 },
      );
    }
    const account = await prisma.creatorRateAccount.update({
      data: { tier: parsed.data.tier },
      where: { userId },
    });
    return NextResponse.json({ account });
  }

  // Grant: admin hands someone artist access directly, no application. Same
  // upsert the application-approval route uses, so the two paths land the
  // same account shape — just notify only the first time, not on a repeat
  // click against an account that already exists.
  if (action === "grant") {
    const existed = (await prisma.creatorRateAccount.findUnique({ where: { userId } })) !== null;
    const account = await prisma.creatorRateAccount.upsert({
      create: { userId },
      update: {},
      where: { userId },
    });
    if (!existed) {
      await prisma.notification.create(
        notifyUser({
          body: "You're a creator now — check Payouts in your account menu to set up cashouts.",
          link: "/app/settings/payouts",
          title: "You've been granted artist access",
          userId,
        }),
      );
    }
    return NextResponse.json({ account });
  }

  const account = await prisma.creatorRateAccount.upsert({
    create: { userId },
    update: {},
    where: { userId },
  });

  let data: { pending?: number; available?: number; lifetime?: number } = {};
  let txRatesAmount = 0;
  let details = "";

  if (action === "reset-pending") {
    txRatesAmount = -account.pending;
    data = { pending: 0 };
    details = `Reset pending Rates balance for ${userName}`;
  } else if (action === "reset-available") {
    txRatesAmount = -account.available;
    data = { available: 0 };
    details = `Reset available Rates balance for ${userName}`;
  } else if (action === "transfer-pending-to-available") {
    if (account.pending <= 0) {
      return NextResponse.json(
        { error: "Invalid request", message: "No pending balance to transfer." },
        { status: 400 },
      );
    }
    data = { available: account.available + account.pending, pending: 0 };
    details = `Transferred ${account.pending} Rates from Pending to Available for ${userName}`;
  } else {
    const { field, direction, amount } = parsed.data as {
      field: "pending" | "available";
      direction: "add" | "deduct";
      amount: number;
    };
    const change = direction === "add" ? amount : -amount;
    const newValue = Math.max(0, account[field] + change);
    data[field] = newValue;
    if (direction === "add") {
      data.lifetime = account.lifetime + change;
    }
    txRatesAmount = change;
    details = `Manual ${direction} of ${amount} ${field} Rates for ${userName}`;
  }

  const exchangeRate = await prisma.financeExchangeRate.upsert({
    create: { id: "singleton" },
    update: {},
    where: { id: "singleton" },
  });

  const [updated] = await prisma.$transaction([
    prisma.creatorRateAccount.update({ data, where: { userId } }),
    prisma.financeTransaction.create({
      data: {
        amount: txRatesAmount * exchangeRate.currentRate,
        details,
        ratesAmount: txRatesAmount,
        status: "Completed",
        type: "Manual Adjustment",
        userId,
        userName,
      },
    }),
  ]);

  return NextResponse.json({ account: updated });
});
