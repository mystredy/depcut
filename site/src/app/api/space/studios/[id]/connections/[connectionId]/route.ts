import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/space/studio-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; connectionId: string }> };

// Managers only. Disconnects a Repurpose destination.
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, connectionId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.studioId !== id) return notFoundResponse();

  await prisma.socialConnection.delete({ where: { id: connectionId } });
  await logStudioActivity({
    action: `Disconnected ${connection.accountName} (${connection.platform})`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({ ok: true });
});
