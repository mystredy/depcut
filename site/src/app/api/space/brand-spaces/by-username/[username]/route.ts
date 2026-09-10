import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership } from "@/lib/space/brand-space-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ username: string }> };

// Same shape as GET /api/space/brand-spaces/[id] — the entry point for the
// public profile page at /app/space/brand/[username], which only has the
// username from the URL. Returns the space's id so the page can call the
// id-keyed routes (members, connections, activity, …) after this.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { username } = await context.params;
  const space = await prisma.brandSpace.findUnique({ where: { username } });
  if (!space) return notFoundResponse();

  const membership = await getBrandSpaceMembership(request.depcut.userId, space.id);

  return NextResponse.json({
    space: {
      avatarImageKey: space.avatarImageKey,
      backgroundImageKey: space.backgroundImageKey,
      bio: space.bio,
      id: space.id,
      linkedAccounts: space.linkedAccounts ?? {},
      name: space.name,
      role: membership?.role ?? null,
      spaceType: space.spaceType,
      username: space.username,
    },
  });
});
