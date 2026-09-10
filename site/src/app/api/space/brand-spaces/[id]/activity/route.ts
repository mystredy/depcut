import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership } from "@/lib/space/brand-space-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Managers only. The Management history section — latest 50 actions.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const activity = await prisma.brandSpaceActivity.findMany({
    include: { actor: { select: { displayName: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    where: { brandSpaceId: id },
  });

  return NextResponse.json({
    activity: activity.map((a) => ({
      action: a.action,
      actorName: a.actor?.displayName || a.actor?.name || "DepCut",
      createdAt: a.createdAt.toISOString(),
      detail: a.detail,
      id: a.id,
    })),
  });
});
