import { z } from "zod";

import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { defineJob } from "@/lib/jobs/registry";
import { prisma } from "@/lib/prisma";
import { publishDropToWorkflow } from "@/lib/studio/dropPublish";

// The daily "Repurpose existing content" sweep — see /api/social-workflows/run.
// For every Active, non-autoPublish workflow (studio source only; platform
// sources aren't executed anywhere yet), publishes up to postsPerDay of the
// studio's Drops that this exact workflow hasn't successfully sent yet,
// oldest first. A backlog, not a rotation: once every Drop has a successful
// DropPublication row for this workflow, there's nothing left to pick and
// the workflow goes quiet — it does not start over.
export const socialWorkflowDripJob = defineJob(z.object({}).strict(), async () => {
  const allWorkflows = await prisma.socialWorkflow.findMany({
    include: { destinationConnection: true, sourceConnection: true },
    where: {
      autoPublish: false,
      postsPerDay: { not: null },
      sourceConnection: { platform: STUDIO_SOURCE_PLATFORM },
      status: "Active",
    },
  });
  // The studio pseudo-connection this query matched on is always created
  // with a studioId (see ensureStudioSourceConnection) — this narrows the
  // type rather than asserting it, since studioId is nullable on
  // SocialConnection in general.
  const workflows = allWorkflows.filter(
    (w): w is typeof w & { sourceConnection: { studioId: string } } => w.sourceConnection.studioId !== null,
  );

  const results = await Promise.all(
    workflows.map(async (workflow) => {
      const alreadySent = await prisma.dropPublication.findMany({
        select: { dropId: true },
        where: { status: "success", workflowId: workflow.id },
      });

      const drops = await prisma.drop.findMany({
        orderBy: { createdAt: "asc" },
        take: workflow.postsPerDay!,
        where: {
          id: { notIn: alreadySent.map((p) => p.dropId) },
          status: "complete",
          studioId: workflow.sourceConnection.studioId,
        },
      });

      const outcomes = await Promise.all(drops.map((drop) => publishDropToWorkflow(drop, workflow)));
      return { dropsPicked: drops.length, outcomes, workflowId: workflow.id };
    }),
  );

  return { results, workflowsChecked: workflows.length };
});
