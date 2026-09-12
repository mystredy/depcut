import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { sendStudioInvite } from "@/lib/email/send-studio-invite";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/studio/access";
import { verifyInviteChallenge } from "@/lib/studio/invite-verification";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Managers only. Pending invites — the studio access section's "invited,
// not yet joined" list.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const invites = await prisma.studioInvite.findMany({
    orderBy: { createdAt: "desc" },
    where: { status: "Pending", studioId: id },
  });

  return NextResponse.json({
    invites: invites.map((i) => ({
      createdAt: i.createdAt.toISOString(),
      email: i.email,
      id: i.id,
      role: i.role,
    })),
  });
});

const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    challenge: z.string().min(1),
    code: z.string().length(6),
  })
  .strict();

// Managers only. Step 2 of inviting someone: requires the challenge and
// code from POST .../invites/request-code, proving the requesting manager
// approved this exact invite from their own inbox. Only then creates the
// invite, emails it, and logs the action — resending to the same email
// replaces the still-pending invite rather than piling up duplicates.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const verified = verifyInviteChallenge({
    challenge: parsed.data.challenge,
    code: parsed.data.code,
    email: parsed.data.email,
    requesterId: request.depcut.userId,
    studioId: id,
  });
  if (!verified) {
    return NextResponse.json(
      { error: "invalid_code", message: "That code is wrong or expired. Request a new one." },
      { status: 400 },
    );
  }

  const studio = await prisma.studio.findUnique({ where: { id } });
  if (!studio) return notFoundResponse();

  const inviter = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: request.depcut.userId },
  });

  const existingMember = await prisma.studioMember.findFirst({
    where: { studioId: id, user: { email: parsed.data.email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "Already a manager", message: "That email already manages this studio." },
      { status: 409 },
    );
  }

  await prisma.studioInvite.deleteMany({
    where: { email: parsed.data.email, status: "Pending", studioId: id },
  });

  const token = randomBytes(24).toString("base64url");
  const invite = await prisma.studioInvite.create({
    data: {
      email: parsed.data.email,
      invitedById: request.depcut.userId,
      studioId: id,
      token,
    },
  });

  try {
    await sendStudioInvite({
      acceptUrl: `${request.nextUrl.origin}/app/studio/invites/${token}`,
      inviterName: inviter?.displayName || inviter?.name || "Someone",
      studioName: studio.name,
      toEmail: parsed.data.email,
    });
  } catch (error) {
    await prisma.studioInvite.delete({ where: { id: invite.id } });
    return NextResponse.json(
      { error: "Send failed", message: error instanceof Error ? error.message : "Couldn't send the invite email." },
      { status: 502 },
    );
  }

  await logStudioActivity({
    action: `Invited ${parsed.data.email} to manage the studio`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({
    invite: { createdAt: invite.createdAt.toISOString(), email: invite.email, id: invite.id, role: invite.role },
  });
});
