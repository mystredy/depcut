import type { Drop, SocialConnection, SocialWorkflow } from "@/generated/prisma/client";
import { presignGet } from "@/cut/server/cloud/r2";
import { publishToConnection, PublishError, type PublishResult } from "@/lib/marketplace/publish";
import { prisma } from "@/lib/prisma";

export type DropPublishOutcome =
  | { ok: true; workflowId: string; published: PublishResult }
  | { ok: false; workflowId: string; error: string };

// Publishes one Drop to one workflow's destination and records the outcome
// as a DropPublication row — success or failure, including the platform's
// own post id. Shared by both execution paths: social-workflow-publish.ts
// (fires once, right when a Drop completes) and social-workflow-drip.ts
// (the daily backlog sweep) both call this rather than duplicating the
// publish-then-record logic.
export async function publishDropToWorkflow(
  drop: Drop,
  workflow: SocialWorkflow & { destinationConnection: SocialConnection },
): Promise<DropPublishOutcome> {
  const title = drop.title || drop.caption?.slice(0, 80) || "New post";

  try {
    if (!drop.storageKey) throw new PublishError("This Drop has no uploaded video.");
    const videoUrl = await presignGet(drop.storageKey);
    const published = await publishToConnection(workflow.destinationConnectionId, {
      description: drop.caption ?? undefined,
      privacyStatus: "public",
      title,
      videoUrl,
    });
    await prisma.dropPublication.create({
      data: {
        destinationAccountName: workflow.destinationConnection.accountName,
        destinationConnectionId: workflow.destinationConnectionId,
        dropId: drop.id,
        externalPostId: published.videoId ?? published.publishId ?? published.id ?? null,
        externalUrl: published.url ?? null,
        platform: workflow.destinationConnection.platform,
        status: "success",
        workflowId: workflow.id,
      },
    });
    return { ok: true, published, workflowId: workflow.id };
  } catch (e) {
    const message = e instanceof PublishError ? e.message : e instanceof Error ? e.message : "Publish failed.";
    await prisma.dropPublication.create({
      data: {
        destinationAccountName: workflow.destinationConnection.accountName,
        destinationConnectionId: workflow.destinationConnectionId,
        dropId: drop.id,
        error: message,
        platform: workflow.destinationConnection.platform,
        status: "failed",
        workflowId: workflow.id,
      },
    });
    return { error: message, ok: false, workflowId: workflow.id };
  }
}
