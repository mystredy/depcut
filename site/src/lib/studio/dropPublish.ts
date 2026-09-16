import type { Drop, SocialConnection, SocialWorkflow } from "@/generated/prisma/client";
import { presignGet } from "@/cut/server/cloud/r2";
import { publishToConnection, PublishError, type PublishResult } from "@/lib/marketplace/publish";
import { prisma } from "@/lib/prisma";

export type DropPublishOutcome =
  | { ok: true; workflowId: string | null; published: PublishResult }
  | { ok: false; workflowId: string | null; error: string };

// Publishes one Drop to one connection and records the outcome as a
// DropPublication row — success or failure, including the platform's own
// post id. workflowId is null for a manual one-off repurpose (see
// /api/studios/[id]/drops/[dropId]/repurpose), which has no SocialWorkflow
// behind it. overrides lets that same manual flow send a title/description
// amended just for this platform, without touching the Drop's own stored
// values — omitted, the two automated callers below publish the Drop
// exactly as stored, same as before this existed.
export async function publishDropToConnection(
  drop: Drop,
  destinationConnection: SocialConnection,
  workflowId: string | null,
  overrides?: { title?: string; caption?: string },
): Promise<DropPublishOutcome> {
  const title = overrides?.title || drop.title || drop.caption?.slice(0, 80) || "New post";
  const caption = overrides ? overrides.caption : (drop.caption ?? undefined);

  try {
    if (!drop.storageKey) throw new PublishError("This Drop has no uploaded video.");
    const videoUrl = await presignGet(drop.storageKey);
    const published = await publishToConnection(destinationConnection.id, {
      description: caption,
      privacyStatus: "public",
      title,
      videoUrl,
    });
    await prisma.dropPublication.create({
      data: {
        destinationAccountName: destinationConnection.accountName,
        destinationConnectionId: destinationConnection.id,
        dropId: drop.id,
        externalPostId: published.videoId ?? published.publishId ?? published.id ?? null,
        externalUrl: published.url ?? null,
        platform: destinationConnection.platform,
        status: "success",
        workflowId,
      },
    });
    return { ok: true, published, workflowId };
  } catch (e) {
    const message = e instanceof PublishError ? e.message : e instanceof Error ? e.message : "Publish failed.";
    await prisma.dropPublication.create({
      data: {
        destinationAccountName: destinationConnection.accountName,
        destinationConnectionId: destinationConnection.id,
        dropId: drop.id,
        error: message,
        platform: destinationConnection.platform,
        status: "failed",
        workflowId,
      },
    });
    return { error: message, ok: false, workflowId };
  }
}

// Thin wrapper for the two automated callers — social-workflow-publish.ts
// (fires once, right when a Drop completes) and social-workflow-drip.ts
// (the daily backlog sweep) — which both have a real SocialWorkflow behind
// the publish.
export function publishDropToWorkflow(
  drop: Drop,
  workflow: SocialWorkflow & { destinationConnection: SocialConnection },
): Promise<DropPublishOutcome> {
  return publishDropToConnection(drop, workflow.destinationConnection, workflow.id);
}
