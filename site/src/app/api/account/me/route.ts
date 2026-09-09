import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Minimal identity for the settings UI: who am I, am I a super user (which
// gates the manual credit-grant card), am I an artist and what tier (which
// gates the Artist sidebar group, its routes, and the editor's Submit
// button), and do I earn from any program (which gates Payouts on its own —
// DepArtist and Affiliate each grant it independently; a Creator Partner
// program will join this list once it exists). Session-only.
export const GET = withDepCutAuth(async (request) => {
  const user = await prisma.user.findUnique({
    select: {
      affiliate: { select: { userId: true } },
      creatorRateAccount: { select: { tier: true, userId: true } },
      email: true,
      superUser: true,
    },
    where: { id: request.depcut.userId },
  });

  return NextResponse.json({
    creatorTier: user?.creatorRateAccount?.tier ?? null,
    email: user?.email ?? null,
    isArtist: user?.creatorRateAccount != null,
    payoutsEligible: user?.creatorRateAccount != null || user?.affiliate != null,
    superUser: user?.superUser === true,
    userId: request.depcut.userId,
  });
});
