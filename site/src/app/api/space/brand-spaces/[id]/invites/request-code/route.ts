import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { sendBrandSpaceInviteCode } from "@/lib/email/send-brand-space-invite-code";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership } from "@/lib/space/brand-space-access";
import { createInviteChallenge, generateInviteCode } from "@/lib/space/invite-verification";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
  })
  .strict();

// Managers only. Step 1 of inviting someone: emails a one-time code to the
// REQUESTING manager's own address. The actual invite (POST /invites) only
// sends once that code comes back — see lib/space/invite-verification.ts.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const [space, requester] = await Promise.all([
    prisma.brandSpace.findUnique({ select: { name: true }, where: { id } }),
    prisma.user.findUnique({ select: { email: true }, where: { id: request.depcut.userId } }),
  ]);
  if (!space || !requester) return notFoundResponse();

  const existingMember = await prisma.brandSpaceMember.findFirst({
    where: { brandSpaceId: id, user: { email: parsed.data.email } },
  });
  if (existingMember) {
    return NextResponse.json(
      { error: "Already a manager", message: "That email already manages this space." },
      { status: 409 },
    );
  }

  const code = generateInviteCode();
  try {
    await sendBrandSpaceInviteCode({
      code,
      inviteEmail: parsed.data.email,
      requesterEmail: requester.email,
      spaceName: space.name,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "email_failed", message: error instanceof Error ? error.message : "Couldn't send the code." },
      { status: 502 },
    );
  }

  const challenge = createInviteChallenge({
    brandSpaceId: id,
    code,
    email: parsed.data.email,
    requesterId: request.depcut.userId,
  });
  return NextResponse.json({ challenge, sentTo: requester.email });
});
