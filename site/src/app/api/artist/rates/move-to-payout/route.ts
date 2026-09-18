import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

const moveSchema = z.object({ rates: z.number().int().positive() }).strict();

// Self-serve: a creator moves some of their own cleared Rates
// (ArtistRateAccount.available) into their Payout wallet
// (PayoutAccount.available), converting at the current
// FinanceExchangeRate — the only place that conversion happens. This
// doesn't need admin approval; it's an internal move, not real money
// leaving the platform. Only the destination, PayoutAccount.available, is
// ever drawn down by a real Withdrawal (see admin/finance/withdrawals).
export const POST = withDepCutAuth(async (request) => {
  const parsed = moveSchema.safeParse(await request.json());
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

  const userId = request.depcut.userId;
  const { rates } = parsed.data;

  const [account, exchangeRate, user] = await Promise.all([
    prisma.artistRateAccount.findUnique({ select: { available: true }, where: { userId } }),
    prisma.financeExchangeRate.upsert({ create: { id: SINGLETON_ID }, update: {}, where: { id: SINGLETON_ID } }),
    prisma.user.findUnique({ select: { displayName: true, email: true, name: true }, where: { id: userId } }),
  ]);

  if (!account || account.available < rates) {
    return NextResponse.json(
      { error: "Invalid request", message: "Amount exceeds your available Rates." },
      { status: 400 },
    );
  }

  const usd = rates * exchangeRate.currentRate;
  const userName = user?.displayName || user?.name || user?.email || "Artist";

  await prisma.$transaction([
    prisma.artistRateAccount.update({
      data: { available: { decrement: rates } },
      where: { userId },
    }),
    prisma.payoutAccount.upsert({
      create: { available: usd, lifetime: usd, userId },
      update: { available: { increment: usd }, lifetime: { increment: usd } },
      where: { userId },
    }),
    prisma.financeTransaction.create({
      data: {
        amount: usd,
        details: `Moved ${rates} Rates to Payout at $${exchangeRate.currentRate}/Rate`,
        ratesAmount: -rates,
        type: "Move to Payout",
        userId,
        userName,
      },
    }),
  ]);

  return NextResponse.json({ movedRates: rates, movedUsd: usd });
});
