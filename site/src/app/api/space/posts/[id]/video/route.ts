import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { presignGet } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Redirects to a short-lived signed R2 GET URL — same pattern as the
// submission video route. Posts are private to their own account for now
// (My Space isn't public yet), so this only ever answers the poster.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const post = await prisma.spacePost.findUnique({
    select: { storageKey: true, userId: true },
    where: { id },
  });
  if (!post?.storageKey) return notFoundResponse();
  if (post.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const url = await presignGet(post.storageKey);
  return NextResponse.redirect(url);
});
