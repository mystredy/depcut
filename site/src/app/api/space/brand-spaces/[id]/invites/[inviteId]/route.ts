import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership, logBrandSpaceActivity } from "@/lib/space/brand-space-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; inviteId: string }> };

// Managers only. Revokes a still-pending invite.
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, inviteId } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const invite = await prisma.brandSpaceInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.brandSpaceId !== id) return notFoundResponse();

  await prisma.brandSpaceInvite.update({ data: { status: "Revoked" }, where: { id: inviteId } });
  await logBrandSpaceActivity({
    action: `Revoked the invite to ${invite.email}`,
    actorId: request.depcut.userId,
    brandSpaceId: id,
  });

  return NextResponse.json({ ok: true });
});
