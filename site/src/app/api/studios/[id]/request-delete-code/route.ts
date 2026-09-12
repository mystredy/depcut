import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { sendStudioDeleteCode } from "@/lib/email/send-studio-delete-code";
import { prisma } from "@/lib/prisma";
import { createDeleteChallenge, generateDeleteCode } from "@/lib/studio/delete-verification";
import { notifyStudioDeleteCode } from "@/lib/studio/notify-delete-code";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Owner only. Step 1 of deleting a studio: sends a one-time code to the
// owner's own email (and Telegram, if linked). The actual delete
// (DELETE /api/studios/[id]) only proceeds once that code comes back — see
// lib/studio/delete-verification.ts.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const [studio, owner] = await Promise.all([
    prisma.studio.findUnique({ select: { name: true, ownerId: true }, where: { id } }),
    prisma.user.findUnique({ select: { email: true }, where: { id: request.depcut.userId } }),
  ]);
  if (!studio || !owner) return notFoundResponse();
  if (studio.ownerId !== request.depcut.userId) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only the owner can delete this studio." },
      { status: 403 },
    );
  }

  const code = generateDeleteCode();
  try {
    await sendStudioDeleteCode({ code, ownerEmail: owner.email, studioName: studio.name });
  } catch (error) {
    return NextResponse.json(
      { error: "email_failed", message: error instanceof Error ? error.message : "Couldn't send the code." },
      { status: 502 },
    );
  }
  await notifyStudioDeleteCode({ code, studioName: studio.name, userId: request.depcut.userId });

  const challenge = createDeleteChallenge({ code, requesterId: request.depcut.userId, studioId: id });
  return NextResponse.json({ challenge, sentTo: owner.email });
});
