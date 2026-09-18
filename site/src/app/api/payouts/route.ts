import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The signed-in creator's own Payout wallet (USD) — read-only, shown on
// /app/settings/payouts only. Separate from ArtistRateAccount (see
// /api/artist/rates): this is the only balance a real Withdrawal ever
// draws down (see admin/finance/withdrawals). PayoutAccount is created
// lazily, so a creator who's never moved Rates here has no row at all;
// that reads as all zeros rather than a 404.
export const GET = withDepCutAuth(async (request) => {
  const account = await prisma.payoutAccount.findUnique({
    select: { available: true, lifetime: true },
    where: { userId: request.depcut.userId },
  });

  return NextResponse.json({
    available: account?.available ?? 0,
    lifetime: account?.lifetime ?? 0,
  });
});
