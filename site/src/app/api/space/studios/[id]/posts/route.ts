import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Any signed-in account can view a Studio's posts — same
// sign-in-required convention as the rest of Space. Same shape as
// GET /api/space/posts.
export const GET = withDepCutAuth(async (_request, context: RouteContext) => {
  const { id } = await context.params;
  const space = await prisma.studio.findUnique({ select: { id: true }, where: { id } });
  if (!space) return notFoundResponse();

  const posts = await prisma.spacePost.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      caption: true,
      createdAt: true,
      error: true,
      fileName: true,
      id: true,
      sizeBytes: true,
      status: true,
      thumbnailKey: true,
    },
    where: { studioId: id },
  });

  return NextResponse.json({ posts });
});
