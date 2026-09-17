import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { presignGet } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { canViewDrop } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Redirects to a short-lived signed R2 GET URL — same pattern as the
// submission video route. Gated by canViewDrop (also GET /api/drops/[id]'s
// gate): a manager can always watch their own drop, anyone else only once
// it's posted and not "private" — this is what actually enforces "private"
// rather than just hiding it from the grid, since the video bytes are
// otherwise reachable by anyone who has this URL.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const drop = await prisma.drop.findUnique({
    select: { status: true, storageKey: true, studioId: true, visibility: true },
    where: { id },
  });
  if (!drop?.storageKey) return notFoundResponse();
  if (!(await canViewDrop(request.depcut.userId, drop))) return notFoundResponse();

  const url = await presignGet(drop.storageKey);
  return NextResponse.redirect(url);
});
