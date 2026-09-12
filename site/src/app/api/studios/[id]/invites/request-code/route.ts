import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { sendStudioInviteCode } from "@/lib/email/send-studio-invite-code";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";
import { createInviteChallenge, generateInviteCode } from "@/lib/studio/invite-verification";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
  })
  .strict();

// Managers only. Step 1 of inviting someone: emails a one-time code to the
// REQUESTING manager's own address. The actual invite (POST /invites) only
// sends once that code comes back — see lib/studio/invite-verification.ts.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const [studio, requester] = await Promise.all([
    prisma.studio.findUnique({ select: { name: true }, where: { id } }),
    prisma.user.findUnique({ select: { email: true }, where: { id: request.depcut.userId } }),
  ]);
  if (!studio || !requester) return notFoundResponse();

  const existingMember = await prisma.studioMember.findFirst({
    where: { studioId: id, user: { email: parsed.data.email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "Already a manager", message: "That email already manages this studio." },
      { status: 409 },
    );
  }

  const code = generateInviteCode();
  try {
    await sendStudioInviteCode({
      code,
      inviteEmail: parsed.data.email,
      requesterEmail: requester.email,
      studioName: studio.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "email_failed", message: error instanceof Error ? error.message : "Couldn't send the code." },
      { status: 502 },
    );
  }

  const challenge = createInviteChallenge({
    code,
    email: parsed.data.email,
    requesterId: request.depcut.userId,
    studioId: id,
  });
  return NextResponse.json({ challenge, sentTo: requester.email });
});
