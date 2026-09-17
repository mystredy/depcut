import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { canViewDrop } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// One drop by id — same shape as an entry in GET /api/studios/[id]/drops.
// What makes an "unlisted" drop's direct link actually work: that list
// endpoint excludes unlisted/private drops from the studio grid entirely
// (see its own comment), so a viewer who isn't a manager needs this route to
// resolve a ?drop=<id> link the studio grid itself won't surface. canViewDrop
// is the one gate both this route and the video route share.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;

  const drop = await prisma.drop.findUnique({
    select: {
      caption: true,
      createdAt: true,
      error: true,
      fileName: true,
      hashtags: true,
      id: true,
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
      studioId: true,
      thumbnailKey: true,
      title: true,
      visibility: true,
    },
    where: { id },
  });
  if (!drop) return notFoundResponse();
  if (!(await canViewDrop(request.depcut.userId, drop))) return notFoundResponse();

  return NextResponse.json({ drop });
});
