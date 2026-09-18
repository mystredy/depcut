import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

// Super-user only. Every creator cashout request.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.withdrawal.findMany({
    include: { user: { select: { displayName: true, email: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const withdrawals = rows.map((w) => ({ ...w, userName: w.user.displayName || w.user.name }));

  return NextResponse.json({ withdrawals });
});

// Records a cashout request against a creator's Payout (USD) balance —
// reserves (deducts) the requested amount immediately, same as a real
// request would. amountRequested is USD, not Rates: PayoutAccount already
// holds converted money (see api/artist/rates/move-to-payout), so no
// exchange-rate conversion happens here.
const createSchema = z
  .object({
    userId: z.string().trim().min(1),
    amountRequested: z.number().int().positive(),
    method: z.string().trim().min(1).max(60),
    destination: z.string().trim().min(1).max(200),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
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

  const { userId, amountRequested, method, destination } = parsed.data;

  const account = await prisma.payoutAccount.upsert({
    create: { userId },
    update: {},
    where: { userId },
  });
  if (account.available < amountRequested) {
    return NextResponse.json(
      { error: "Invalid request", message: "Amount exceeds the creator's available Payout balance." },
      { status: 400 },
    );
  }

  const settings = await prisma.financeSettings.upsert({
    create: { id: "singleton" },
    update: {},
    where: { id: "singleton" },
  });

  // Already USD by the time it lands in PayoutAccount — only fee/tax apply.
  const grossUsd = amountRequested;
  const processingFee = grossUsd * (settings.processingFeePct / 100);
  const tax = grossUsd * (settings.taxPct / 100);
  const finalAmount = Math.max(0, grossUsd - processingFee - tax);

  const [withdrawal] = await prisma.$transaction([
    prisma.withdrawal.create({
      data: {
        amountRequested,
        destination,
        exchangeRateUsed: 1,
        finalAmount,
        method,
        processingFee,
        userId,
      },
      include: { user: { select: { displayName: true, email: true, name: true } } },
    }),
    prisma.payoutAccount.update({
      data: { available: account.available - amountRequested },
      where: { userId },
    }),
  ]);

  const { user, ...withdrawalFields } = withdrawal;
  const requesterName = user.displayName || user.name || user.email;
  await notifyTelegram(
    "withdrawal",
    `💸 Withdrawal requested: $${amountRequested} by ${requesterName} via ${method}`,
  );

  return NextResponse.json({ withdrawal: { ...withdrawalFields, userName: requesterName } });
});
