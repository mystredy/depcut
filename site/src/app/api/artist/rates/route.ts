import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The signed-in creator's own Rates wallet — read-only. ArtistRateAccount is
// created lazily (see its own doc comment), so a creator who hasn't had a
// submission approved yet has no row at all; that reads as all zeros here
// rather than a 404.
export const GET = withDepCutAuth(async (request) => {
  const [account, exchangeRate] = await Promise.all([
    prisma.artistRateAccount.findUnique({
      select: { available: true, lifetime: true, pending: true },
      where: { userId: request.depcut.userId },
    }),
    prisma.financeExchangeRate.findUnique({ where: { id: "singleton" } }),
  ]);

  return NextResponse.json({
    available: account?.available ?? 0,
    lifetime: account?.lifetime ?? 0,
    pending: account?.pending ?? 0,
    usdPerRate: exchangeRate?.currentRate ?? 0.01,
  });
});
