import { z } from "zod";

import { defineJob } from "@/lib/jobs/registry";
import { listFacebookVideos } from "@/lib/marketplace/facebook-api";
import { listInstagramMedia } from "@/lib/marketplace/instagram-api";
import { getStoredPageAccessToken } from "@/lib/marketplace/meta-pages";
import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";
import { importPostAsDrop, type ImportablePost } from "@/lib/studio/dropImport";

// The daily platform → studio import sweep — see /api/social-workflows/run.
// Finds every Active workflow whose destination is a studio pseudo-
// connection and whose source is Instagram or Facebook, lists that
// account's own video posts, and imports whatever hasn't already been
// pulled in as a Drop (tracked via Drop.importedExternalId). autoPublish
// (mode "Repurpose new posts") imports everything new, uncapped; the
// backlog mode (postsPerDay set) caps it per run.
export const socialWorkflowImportJob = defineJob(z.object({}).strict(), async () => {
  const allWorkflows = await prisma.socialWorkflow.findMany({
    include: { destinationConnection: true, sourceConnection: true },
    where: {
      destinationConnection: { platform: STUDIO_SOURCE_PLATFORM },
      sourceConnection: { platform: { in: ["instagram", "facebook"] } },
      status: "Active",
    },
  });
  const workflows = allWorkflows.filter(
    (w): w is typeof w & { destinationConnection: { studioId: string } } =>
      w.destinationConnection.studioId !== null,
  );

  const results = await Promise.all(
    workflows.map(async (workflow) => {
      const studio = await prisma.studio.findUnique({
        select: { ownerId: true },
        where: { id: workflow.destinationConnection.studioId },
      });
      if (!studio) return { error: "Studio not found.", workflowId: workflow.id };

      const { sourceConnection } = workflow;
      if (!sourceConnection.platformAccountId) {
        return { error: "This connection predates Page linking — remove it and connect again.", workflowId: workflow.id };
      }

      let posts: ImportablePost[];
      try {
        const accessToken = await getStoredPageAccessToken(sourceConnection.id);
        if (sourceConnection.platform === "instagram") {
          const media = await listInstagramMedia(sourceConnection.platformAccountId, accessToken);
          posts = media.map((m) => ({ caption: m.caption, externalId: m.id, videoUrl: m.mediaUrl }));
        } else {
          const videos = await listFacebookVideos(sourceConnection.platformAccountId, accessToken);
          posts = videos.map((v) => ({ caption: v.description, externalId: v.id, videoUrl: v.source }));
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't list posts.";
        return { error: message, workflowId: workflow.id };
      }

      const alreadyImported = new Set(
        (
          await prisma.drop.findMany({
            select: { importedExternalId: true },
            where: {
              importedExternalId: { in: posts.map((p) => p.externalId) },
              importedPlatform: sourceConnection.platform,
              studioId: workflow.destinationConnection.studioId,
            },
          })
        ).map((d) => d.importedExternalId),
      );
      const pending = posts.filter((p) => !alreadyImported.has(p.externalId));
      const toImport = workflow.autoPublish ? pending : pending.slice(0, workflow.postsPerDay ?? 0);

      const outcomes = await Promise.all(
        toImport.map((post) =>
          importPostAsDrop(post, {
            platform: sourceConnection.platform,
            studioId: workflow.destinationConnection.studioId,
            studioOwnerId: studio.ownerId,
          }),
        ),
      );
      return { outcomes, postsFound: posts.length, postsImported: outcomes.length, workflowId: workflow.id };
    }),
  );

  return { results, workflowsChecked: workflows.length };
});
