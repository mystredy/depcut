import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Minimal identity for the settings UI: who am I, am I a super user (which
// gates the manual credit-grant card), and am I an artist (which gates the
// Artist sidebar group, its routes, and Payouts). Session-only.
export const GET = withDepCutAuth(async (request) => {
  const user = await prisma.user.findUnique({
    select: { creatorRateAccount: { select: { userId: true } }, email: true, superUser: true },
    where: { id: request.depcut.userId },
  });

  return NextResponse.json({
    email: user?.email ?? null,
    isArtist: user?.creatorRateAccount != null,
    superUser: user?.superUser === true,
    userId: request.depcut.userId,
  });
});
