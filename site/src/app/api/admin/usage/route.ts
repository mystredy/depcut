import { NextResponse } from "next/server";

import { creditMicrosToString, zeroCreditMicros } from "@/lib/credits/amounts";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only: site-wide usage and credit totals for the admin panel's
// Usage page. Mirrors the shape of the per-user recentUsageTotals in
// lib/credits/inference.ts, but aggregated across every account.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const now = new Date();
  const recentSince = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // "Active" reads from Session.updatedAt, which better-auth touches at most
  // once per its updateAge (one day here, see auth.ts) — so this counts
  // accounts seen at some point in the last day, not who's online this
  // instant.
  const activeSince = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [userCount, activeUserCount, balanceTotals, recentEvents, lifetimeCharged] = await Promise.all([
    prisma.user.count(),
    prisma.session.findMany({
      distinct: ["userId"],
      select: { userId: true },
      where: { updatedAt: { gte: activeSince } },
    }).then((rows) => rows.length),
    prisma.userCreditAccount.aggregate({
      _sum: { balanceMicros: true, lifetimeChargedMicros: true, lifetimeGrantedMicros: true },
    }),
    prisma.inferenceUsageEvent.groupBy({
      _count: { _all: true },
      _sum: { creditCostMicros: true },
      by: ["route", "provider", "model"],
      orderBy: { _sum: { creditCostMicros: "desc" } },
      where: { createdAt: { gte: recentSince } },
    }),
    prisma.inferenceUsageEvent.aggregate({
      _sum: { creditCostMicros: true },
      where: { createdAt: { gte: recentSince } },
    }),
  ]);

  const failedCounts = await prisma.inferenceUsageEvent.groupBy({
    _count: { _all: true },
    by: ["route", "provider", "model"],
    where: { createdAt: { gte: recentSince }, status: "failed" },
  });
  const failedByKey = new Map(
    failedCounts.map((f) => [[f.route, f.provider, f.model].join(" "), f._count._all]),
  );

  return NextResponse.json({
    last30Days: {
      breakdown: recentEvents.map((e) => ({
        count: e._count._all,
        creditsCharged: creditMicrosToString(e._sum.creditCostMicros ?? zeroCreditMicros),
        failedCount: failedByKey.get([e.route, e.provider, e.model].join(" ")) ?? 0,
        model: e.model,
        provider: e.provider,
        route: e.route,
      })),
      totalCharged: creditMicrosToString(lifetimeCharged._sum.creditCostMicros ?? zeroCreditMicros),
    },
    totals: {
      activeUserCount,
      balance: creditMicrosToString(balanceTotals._sum.balanceMicros ?? zeroCreditMicros),
      lifetimeCharged: creditMicrosToString(
        balanceTotals._sum.lifetimeChargedMicros ?? zeroCreditMicros,
      ),
      lifetimeGranted: creditMicrosToString(
        balanceTotals._sum.lifetimeGrantedMicros ?? zeroCreditMicros,
      ),
      userCount,
    },
  });
});
