import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Any signed-in account can view a studio's drops — same sign-in-required
// convention as the rest of Space. Same shape as GET /api/drops.
export const GET = withDepCutAuth(async (_request, context: RouteContext) => {
  const { id } = await context.params;
  const studio = await prisma.studio.findUnique({ select: { id: true }, where: { id } });
  if (!studio) return notFoundResponse();

  const drops = await prisma.drop.findMany({
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

  return NextResponse.json({ drops });
});
