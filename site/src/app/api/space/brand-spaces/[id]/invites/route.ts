import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { sendBrandSpaceInvite } from "@/lib/email/send-brand-space-invite";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership, logBrandSpaceActivity } from "@/lib/space/brand-space-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Managers only. Pending invites — the Space access section's "invited,
// not yet joined" list.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const invites = await prisma.brandSpaceInvite.findMany({
    orderBy: { createdAt: "desc" },
    where: { brandSpaceId: id, status: "Pending" },
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
  })
  .strict();

// Managers only. Creates the invite, emails it, and logs the action —
// resending to the same email replaces the still-pending invite rather
// than piling up duplicates.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = inviteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const space = await prisma.brandSpace.findUnique({ where: { id } });
  if (!space) return notFoundResponse();

  const inviter = await prisma.user.findUnique({
    select: { displayName: true, name: true },
    where: { id: request.depcut.userId },
  });

  const existingMember = await prisma.brandSpaceMember.findFirst({
    where: { brandSpaceId: id, user: { email: parsed.data.email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "Already a manager", message: "That email already manages this space." },
      { status: 409 },
    );
  }

  await prisma.brandSpaceInvite.deleteMany({
    where: { brandSpaceId: id, email: parsed.data.email, status: "Pending" },
  });

  const token = randomBytes(24).toString("base64url");
  const invite = await prisma.brandSpaceInvite.create({
    data: {
      brandSpaceId: id,
      email: parsed.data.email,
      invitedById: request.depcut.userId,
      token,
    },
  });

  try {
    await sendBrandSpaceInvite({
      acceptUrl: `${request.nextUrl.origin}/app/space/invites/${token}`,
      inviterName: inviter?.displayName || inviter?.name || "Someone",
      spaceName: space.name,
      toEmail: parsed.data.email,
    });
  } catch (error) {
    await prisma.brandSpaceInvite.delete({ where: { id: invite.id } });
    return NextResponse.json(
      { error: "Send failed", message: error instanceof Error ? error.message : "Couldn't send the invite email." },
      { status: 502 },
    );
  }

  await logBrandSpaceActivity({
    action: `Invited ${parsed.data.email} to manage the space`,
    actorId: request.depcut.userId,
    brandSpaceId: id,
  });

  return NextResponse.json({
    invite: { createdAt: invite.createdAt.toISOString(), email: invite.email, id: invite.id, role: invite.role },
  });
});
