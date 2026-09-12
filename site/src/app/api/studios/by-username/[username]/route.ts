import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
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

  return NextResponse.json({
    studio: {
      avatarImageKey: studio.avatarImageKey,
      backgroundImageKey: studio.backgroundImageKey,
      bio: studio.bio,
      id: studio.id,
      linkedAccounts: studio.linkedAccounts ?? {},
      name: studio.name,
      role: membership?.role ?? null,
      showFollowerCount: studio.showFollowerCount,
      spaceType: studio.spaceType,
      username: studio.username,
    },
  });
});
