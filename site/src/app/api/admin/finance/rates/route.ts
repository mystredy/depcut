import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { notifyUser } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every user who currently has an artist grant — granting,
// revoking, and setting tier all moved to the Permissions dialog on
// /admin/users; this is a read-only report of the resulting balances (tier
// stays editable inline, since that's a Rates-page concern, not a grant).
// No automated flow credits these yet — see Finance.prisma's module comment.
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
      artistRateAccount: true,
      displayName: true,
      email: true,
      id: true,
      image: true,
      name: true,
    },
    where: {
      artistRateAccount: { isNot: null },
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
        : {}),
    },
  });

  const accounts = users.map((u) => ({
    active: u.artistRateAccount?.active === true,
    available: u.artistRateAccount?.available ?? 0,
    email: u.email,
    image: u.image,
    lifetime: u.artistRateAccount?.lifetime ?? 0,
    name: u.displayName || u.name,
    pending: u.artistRateAccount?.pending ?? 0,
    referral: u.artistRateAccount?.referral ?? 0,
    tier: u.artistRateAccount?.tier ?? "Standard",
    userId: u.id,
  }));

  return NextResponse.json({ accounts });
});

const adjustSchema = z
  .object({
    userId: z.string().trim().min(1),
    action: z.enum([
      "grant",
      "revoke",
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
    const existing = await prisma.artistRateAccount.findUnique({ where: { userId } });
    if (!existing) {
      return NextResponse.json(
        { error: "Invalid request", message: "Grant artist access before setting a tier." },
        { status: 400 },
      );
    }
    const account = await prisma.artistRateAccount.update({
      data: { tier: parsed.data.tier },
      where: { userId },
    });
    return NextResponse.json({ account });
  }

  // Grant: admin hands someone artist access directly, no application. Same
  // upsert the application-approval route uses, so the two paths land the
  // same account shape. Reactivates a previously revoked row rather than
  // starting fresh — Artist Rates keeps their balance history — and notifies
  // whenever access actually changes (never granted, or was revoked), not on
  // a repeat click against an already-active account.
  if (action === "grant") {
    const existing = await prisma.artistRateAccount.findUnique({ where: { userId } });
    const account = await prisma.artistRateAccount.upsert({
      create: { userId },
      update: { active: true },
      where: { userId },
    });
    if (existing?.active !== true) {
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

  // Revoke: the inverse of grant. Any pending/available balance is forfeit —
  // logged as a negative transaction first, the same way reset-pending/
  // reset-available record what they zeroed. The row itself stays (just
  // inactive, balance zeroed) rather than being deleted, so Artist Rates can
  // still show a former artist and re-granting reactivates instead of
  // starting a fresh row.
  if (action === "revoke") {
    const existing = await prisma.artistRateAccount.findUnique({ where: { userId } });
    if (!existing) return NextResponse.json({ ok: true });

    const forfeited = existing.pending + existing.available;
    const exchangeRate = await prisma.financeExchangeRate.upsert({
      create: { id: "singleton" },
      update: {},
      where: { id: "singleton" },
    });
    await prisma.$transaction([
      ...(forfeited > 0
        ? [
            prisma.financeTransaction.create({
              data: {
                amount: -forfeited * exchangeRate.currentRate,
                details: `Revoked artist access for ${userName} — forfeited ${forfeited} Rates`,
                ratesAmount: -forfeited,
                status: "Completed",
                type: "Manual Adjustment",
                userId,
                userName,
              },
            }),
          ]
        : []),
      prisma.artistRateAccount.update({
        data: { active: false, available: 0, pending: 0 },
        where: { userId },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  const account = await prisma.artistRateAccount.upsert({
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
    prisma.artistRateAccount.update({ data, where: { userId } }),
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
