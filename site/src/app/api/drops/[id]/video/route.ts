import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { presignGet } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Redirects to a short-lived signed R2 GET URL — same pattern as the
// submission video route. Any signed-in account can watch it, matching
// GET /api/studios/[id]/drops (the studio's own drop feed carries no
// ownership check either) — a studio's drops are public to its profile,
// not private to whichever manager happened to post them.
export const GET = withDepCutAuth(async (_request, context: RouteContext) => {
  const { id } = await context.params;
  const drop = await prisma.drop.findUnique({
    select: { storageKey: true },
    where: { id },
  });
  if (!drop?.storageKey) return notFoundResponse();

  const url = await presignGet(drop.storageKey);
  return NextResponse.redirect(url);
});
