import { z } from "zod";

import { defineJob } from "@/lib/jobs/registry";
import { enqueueJob } from "@/lib/jobs/queue";
import { prisma } from "@/lib/prisma";

// Runs every ~10 minutes (see /api/drops/schedule/run and vercel.json) —
// publishes every "scheduled" Drop whose scheduledFor has passed. Same
// "complete" transition and social-workflow-publish fan-out as an immediate
// publish (see publish/route.ts); the only difference is what triggered it.
// A drop deleted before its scheduled time (the 3-dot menu's Delete, on a
// scheduled card same as a draft) simply won't be found here — that's how
// scheduling a post gets cancelled, no separate "cancel" action needed.
export const dropScheduleSweepJob = defineJob(z.object({}).strict(), async () => {
  const due = await prisma.drop.findMany({
    select: { id: true, userId: true },
    where: { status: "scheduled", scheduledFor: { lte: new Date() } },
  });

  const results = await Promise.all(
    due.map(async (drop) => {
      // Claims the row atomically (same idiom as the job queue's own
      // execution claim) — if a redelivered or overlapping sweep run
      // already flipped this drop to "complete", the conditional where
      // clause matches zero rows and this run skips it instead of
      // double-publishing.
      const claimed = await prisma.drop.updateMany({
        data: { status: "complete" },
        where: { id: drop.id, status: "scheduled" },
      });
      if (claimed.count === 0) return { dropId: drop.id, skipped: true };

      const job = await enqueueJob("social-workflow-publish", { dropId: drop.id }, drop.userId);
      return { dropId: drop.id, jobId: job.jobId };
    }),
  );

  return { published: results };
});
