import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { isStudioManager } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Any signed-in account can view a studio's drops — same sign-in-required
// convention as the rest of Space. Same shape as GET /api/drops/[id]. For a
// non-manager: "draft" and "scheduled" are excluded (neither is posted yet),
// and only "public" drops show — "unlisted" is deliberately left out of this
// list too (that's the whole point of unlisted: reachable only by a direct
// link, via GET /api/drops/[id], never from browsing the grid) and
// "private" only a manager can see at all. A manager sees everything,
// unfiltered, same as today.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const studio = await prisma.studio.findUnique({ select: { id: true }, where: { id } });
  if (!studio) return notFoundResponse();

  const canSeeDrafts = await isStudioManager(request.depcut.userId, id);

  const drops = await prisma.drop.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      caption: true,
      createdAt: true,
      error: true,
      fileName: true,
      hashtags: true,
      id: true,
      // Which platforms this drop actually reached — drives the grid card's
      // platform badges and whether "View analytics" applies at all.
      publications: {
        select: {
          destinationAccountName: true,
          destinationConnectionId: true,
          externalPostId: true,
          externalUrl: true,
          platform: true,
        },
        where: { status: "success" },
      },
      scheduledFor: true,
      sizeBytes: true,
      status: true,
      thumbnailKey: true,
      title: true,
      visibility: true,
    },
    where: {
      studioId: id,
      ...(canSeeDrafts ? {} : { status: { notIn: ["draft", "scheduled"] }, visibility: "public" }),
    },
  });

  return NextResponse.json({ drops });
});
