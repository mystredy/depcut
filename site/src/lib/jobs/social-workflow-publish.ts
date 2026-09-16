import { z } from "zod";

import { defineJob, JobFailure } from "@/lib/jobs/registry";
import { prisma } from "@/lib/prisma";
import { ensureStudioSourceConnection } from "@/lib/studio/access";
import { publishDropToWorkflow } from "@/lib/studio/dropPublish";

// Fired when a Drop finishes uploading (see /api/drops/[id]/complete) — the
// "Repurpose new posts" half of studio workflows: any Active, autoPublish
// SocialWorkflow whose source is this studio gets the Drop pushed to its
// destination connection via publishDropToWorkflow, which also records the
// attempt (see dropPublish.ts). The platform-as-source direction isn't
// executed anywhere yet; "Repurpose existing content" is social-workflow-drip.ts.
//
// Checking for an existing successful DropPublication before publishing is
// what makes a redelivered job (the queue's own comment: "double delivery
// is safe") safe here specifically — that only protects the job row, not
// an external publish call happening twice.
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
      include: { destinationConnection: true },
      where: { autoPublish: true, sourceConnectionId: source.id, status: "Active" },
    });

    const alreadyPublished = new Set(
      (
        await prisma.dropPublication.findMany({
          select: { workflowId: true },
          where: { dropId, status: "success", workflowId: { in: workflows.map((w) => w.id) } },
        })
      ).map((p) => p.workflowId),
    );
    const pending = workflows.filter((w) => !alreadyPublished.has(w.id));

    const results = await Promise.all(pending.map((workflow) => publishDropToWorkflow(drop, workflow)));

    return { dropId, results };
  },
);
