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

// Managers only. Who can manage this Brand Space today — the Space access
// section's member list.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const members = await prisma.brandSpaceMember.findMany({
    include: { user: { select: { email: true, id: true, image: true, name: true } } },
    orderBy: { createdAt: "asc" },
    where: { brandSpaceId: id },
  });

  return NextResponse.json({
    members: members.map((m) => ({
      email: m.user.email,
      id: m.id,
      image: m.user.image,
      name: m.user.name,
      role: m.role,
      userId: m.userId,
    })),
  });
});
