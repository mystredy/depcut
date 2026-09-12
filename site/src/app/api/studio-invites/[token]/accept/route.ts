import { NextResponse } from "next/server";

import { withDepCutAuth, type DepCutAuthenticatedRequest } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

// Must be signed in, and signed in as the invited email specifically — an
// invite is addressed to an inbox, not to whoever happens to click the
// link. Redeems into a StudioMember row and marks the invite Accepted.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { token } = await context.params;
  const invite = await prisma.studioInvite.findUnique({
    include: { studio: { select: { id: true, name: true, username: true } } },
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
    prisma.studioMember.upsert({
      create: { role: invite.role, studioId: invite.studioId, userId: request.depcut.userId },
      update: {},
      where: { studioId_userId: { studioId: invite.studioId, userId: request.depcut.userId } },
    }),
    prisma.studioInvite.update({ data: { status: "Accepted" }, where: { id: invite.id } }),
  ]);

  await logStudioActivity({
    action: `${user.email} accepted the invite and joined as a manager`,
    actorId: request.depcut.userId,
    studioId: invite.studioId,
  });

  return NextResponse.json({ studio: invite.studio });
});
