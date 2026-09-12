import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

// Owner only. Removes a manager — never the owner's own row (transfer or
// delete the studio instead of trying to remove the last owner).
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, memberId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();
  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Forbidden", message: "Only the owner can remove a manager." },
      { status: 403 },
    );
  }

  const target = await prisma.studioMember.findUnique({
    include: { user: { select: { name: true } } },
    where: { id: memberId },
  });
  if (!target || target.studioId !== id) return notFoundResponse();
  if (target.role === "owner") {
    return NextResponse.json(
      { error: "Forbidden", message: "The owner can't be removed." },
      { status: 403 },
    );
  }

  await prisma.studioMember.delete({ where: { id: memberId } });
  await logStudioActivity({
    action: `Removed ${target.user.name} as a manager`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({ ok: true });
});
