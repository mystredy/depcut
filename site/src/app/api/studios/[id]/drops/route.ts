import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { isStudioManager } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Any signed-in account can view a studio's drops — same sign-in-required
// convention as the rest of Space. Same shape as GET /api/drops. A "draft"
// drop (uploaded but not yet posted — see publish/route.ts) has real video
// bytes behind it with no confirmation the author meant to share it, so
// that one status is manager-only; everything else is public same as today.
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
      sizeBytes: true,
      status: true,
      thumbnailKey: true,
      title: true,
    },
    where: { studioId: id, ...(canSeeDrafts ? {} : { status: { not: "draft" } }) },
  });

  return NextResponse.json({ drops });
});
