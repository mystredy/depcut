import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Aggregate figures for the Finance dashboard.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const [balances, exchangeRate, settings, withdrawalsByStatus, paidWithdrawals] = await Promise.all([
    prisma.creatorRateAccount.aggregate({ _sum: { available: true, pending: true, referral: true, lifetime: true } }),
    prisma.financeExchangeRate.upsert({ create: { id: "singleton" }, update: {}, where: { id: "singleton" } }),
    prisma.financeSettings.upsert({ create: { id: "singleton" }, update: {}, where: { id: "singleton" } }),
    prisma.withdrawal.groupBy({ _count: { _all: true }, by: ["status"] }),
    prisma.withdrawal.aggregate({ _sum: { finalAmount: true }, where: { status: "Paid" } }),
  ]);

  const countByStatus = Object.fromEntries(withdrawalsByStatus.map((w) => [w.status, w._count._all]));

  return NextResponse.json({
    exchangeRate,
    settings,
    totalAvailableRates: balances._sum.available ?? 0,
    totalCreatorPayouts: paidWithdrawals._sum.finalAmount ?? 0,
    totalPendingRates: balances._sum.pending ?? 0,
    totalReferralRates: balances._sum.referral ?? 0,
    totalLifetimeRates: balances._sum.lifetime ?? 0,
    withdrawalCounts: {
      approved: countByStatus.Approved ?? 0,
      paid: countByStatus.Paid ?? 0,
      pending: countByStatus.Pending ?? 0,
      rejected: countByStatus.Rejected ?? 0,
    },
  });
});
