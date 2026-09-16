import { z } from "zod";

import { presignGet } from "@/cut/server/cloud/r2";
import { defineJob, JobFailure } from "@/lib/jobs/registry";
import { publishToConnection, PublishError } from "@/lib/marketplace/publish";
import { prisma } from "@/lib/prisma";
import { ensureStudioSourceConnection } from "@/lib/studio/access";

// Fired when a Drop finishes uploading (see /api/drops/[id]/complete) — the
// "Repurpose new posts" half of studio workflows: any Active, autoPublish
// SocialWorkflow whose source is this studio gets the Drop pushed to its
// destination connection. "Repurpose existing content" (postsPerDay) and
// the platform-as-source direction aren't executed anywhere yet.
export const socialWorkflowPublishJob = defineJob(
  z.object({ dropId: z.string().trim().min(1) }).strict(),
  async ({ dropId }) => {
    const drop = await prisma.drop.findUnique({ where: { id: dropId } });
    if (!drop) throw new JobFailure("Drop not found.");
    if (drop.status !== "complete" || !drop.storageKey) {
      throw new JobFailure(`Drop isn't complete (status: ${drop.status}).`);
    }

    const source = await ensureStudioSourceConnection(drop.studioId);
    const workflows = await prisma.socialWorkflow.findMany({
      where: { autoPublish: true, sourceConnectionId: source.id, status: "Active" },
    });

    const videoUrl = workflows.length > 0 ? await presignGet(drop.storageKey) : null;
    const title = drop.title || drop.caption?.slice(0, 80) || "New post";

    const results = await Promise.all(
      workflows.map(async (workflow) => {
        try {
          const published = await publishToConnection(workflow.destinationConnectionId, {
            description: drop.caption ?? undefined,
            privacyStatus: "public",
            title,
            videoUrl: videoUrl!,
          });
          return { ok: true as const, published, workflowId: workflow.id };
        } catch (e) {
          const message = e instanceof PublishError ? e.message : e instanceof Error ? e.message : "Publish failed.";
          return { error: message, ok: false as const, workflowId: workflow.id };
        }
      }),
    );

    return { dropId, results };
  },
);
