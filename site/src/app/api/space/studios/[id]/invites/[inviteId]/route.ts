import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/space/studio-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

// Managers only. Revokes a still-pending invite.
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, inviteId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const invite = await prisma.studioInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.studioId !== id) return notFoundResponse();

  await prisma.studioInvite.update({ data: { status: "Revoked" }, where: { id: inviteId } });
  await logStudioActivity({
    action: `Revoked the invite to ${invite.email}`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({ ok: true });
});
