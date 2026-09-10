import { NextResponse } from "next/server";

import { withDepCutAuth, type DepCutAuthenticatedRequest } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { logBrandSpaceActivity } from "@/lib/space/brand-space-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// Must be signed in, and signed in as the invited email specifically — an
// invite is addressed to an inbox, not to whoever happens to click the
// link. Redeems into a BrandSpaceMember row and marks the invite Accepted.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { token } = await context.params;
  const invite = await prisma.brandSpaceInvite.findUnique({
    include: { brandSpace: { select: { id: true, name: true, username: true } } },
    where: { token },
  });
  if (!invite || invite.status !== "Pending") {
    return NextResponse.json(
      { error: "Invalid invite", message: "This invite is no longer valid." },
      { status: 404 },
    );
  }

  const user = await prisma.user.findUnique({
    select: { email: true },
    where: { id: request.depcut.userId },
  });
  if (user?.email?.toLowerCase() !== invite.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Wrong account", message: `This invite was sent to ${invite.email} — sign in with that account.` },
      { status: 403 },
    );
  }

  await prisma.$transaction([
    prisma.brandSpaceMember.upsert({
      create: { brandSpaceId: invite.brandSpaceId, role: invite.role, userId: request.depcut.userId },
      update: {},
      where: { brandSpaceId_userId: { brandSpaceId: invite.brandSpaceId, userId: request.depcut.userId } },
    }),
    prisma.brandSpaceInvite.update({ data: { status: "Accepted" }, where: { id: invite.id } }),
  ]);

  await logBrandSpaceActivity({
    action: `${user.email} accepted the invite and joined as a manager`,
    actorId: request.depcut.userId,
    brandSpaceId: invite.brandSpaceId,
  });

  return NextResponse.json({ space: invite.brandSpace });
});
