import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Managers only. This studio's Repurpose destinations — same redaction as
// the admin list (reads only ever say whether a token is set, never the
// value).
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const connections = await prisma.socialConnection.findMany({
    orderBy: { createdAt: "desc" },
    where: { studioId: id },
  });

  return NextResponse.json({
    connections: connections.map(({ accessToken, refreshToken, ...c }) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      hasToken: Boolean(accessToken),
      tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
});
