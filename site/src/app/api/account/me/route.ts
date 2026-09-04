import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Minimal identity for the settings UI: who am I, and am I a super user (which
// gates the manual credit-grant card). Session-only.
export const GET = withDepCutAuth(async (request) => {
  const user = await prisma.user.findUnique({
    select: { email: true, superUser: true },
    where: { id: request.depcut.userId },
  });

  return NextResponse.json({
    email: user?.email ?? null,
    superUser: user?.superUser === true,
    userId: request.depcut.userId,
  });
});
