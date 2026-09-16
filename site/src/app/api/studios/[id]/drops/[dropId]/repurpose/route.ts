import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { isConnectionUsable, PUBLISHABLE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getStudioMembership } from "@/lib/studio/access";
import { publishDropToConnection } from "@/lib/studio/dropPublish";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; dropId: string }> };

const repurposeSchema = z.object({
  destinationConnectionId: z.string().trim().min(1),
});

// Managers only. A manual, one-off publish of an already-posted Drop to a
// connected platform right now — distinct from the "Repurpose new posts"
// preset (NewPostsPresetRow), which is a standing rule for future Drops.
// Shares publishDropToConnection with the automated jobs, just with no
// SocialWorkflow behind it (workflowId: null on the DropPublication row).
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, dropId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const drop = await prisma.drop.findUnique({ where: { id: dropId } });
  if (!drop || drop.studioId !== id) return notFoundResponse();
  if (drop.status !== "complete") {
    return NextResponse.json(
      { error: "Not ready", message: "Only a posted drop can be repurposed." },
      { status: 400 },
    );
  }

  const parsed = repurposeSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const destination = await prisma.socialConnection.findUnique({
    where: { id: parsed.data.destinationConnectionId },
  });
  if (!destination || destination.studioId !== id) return notFoundResponse();

  if (!PUBLISHABLE_PLATFORMS.includes(destination.platform)) {
    return NextResponse.json(
      { error: "Unsupported platform", message: `Publishing to ${destination.platform} isn't supported.` },
      { status: 400 },
    );
  }
  if (!isConnectionUsable({
    hasRefreshToken: Boolean(destination.refreshToken),
    hasToken: Boolean(destination.accessToken),
    status: destination.status,
    tokenExpiresAt: destination.tokenExpiresAt,
  })) {
    return NextResponse.json(
      { error: "Unsupported connection", message: `${destination.accountName} needs to be reconnected first.` },
      { status: 400 },
    );
  }

  const outcome = await publishDropToConnection(drop, destination, null);
  if (!outcome.ok) {
    return NextResponse.json({ error: "Repurpose failed", message: outcome.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, published: outcome.published });
});
