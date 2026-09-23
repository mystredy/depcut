import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ username: string }> };

// Same shape as GET /api/studios/[id] — the entry point for the public
// profile page at /app/studio/[username], which only has the username from
// the URL. Returns the studio's id so the page can call the id-keyed
// routes (members, connections, activity, …) after this.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { username } = await context.params;
  const studio = await prisma.studio.findUnique({ where: { username } });
  if (!studio) return notFoundResponse();

  const membership = await getStudioMembership(request.depcut.userId, studio.id);

  // The public "which platforms is this studio on" row — just the platform
  // and its handle, never the token fields GET /api/studios/[id]/connections
  // returns (that route stays manager-only for that reason).
  const connections = await prisma.socialConnection.findMany({
    orderBy: { createdAt: "asc" },
    select: { accountHandle: true, id: true, platform: true },
    where: {
      accountHandle: { not: null },
      platform: { not: STUDIO_SOURCE_PLATFORM },
      studioId: studio.id,
    },
  });

  return NextResponse.json({
    connections,
    studio: {
      avatarImageKey: studio.avatarImageKey,
      backgroundImageKey: studio.backgroundImageKey,
      bio: studio.bio,
      id: studio.id,
      name: studio.name,
      role: membership?.role ?? null,
      showFollowerCount: studio.showFollowerCount,
      spaceType: studio.spaceType,
      updatedAt: studio.updatedAt,
      username: studio.username,
    },
  });
});
