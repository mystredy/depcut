import { NextRequest, NextResponse } from "next/server";

import { isVercelCron, notFoundResponse } from "@/lib/depcut-api-auth";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
// Without a queue configured (local dev) the job runs inline before the
// response; give it room.
export const maxDuration = 300;

// The daily social-workflow sweep — both directions run from this one cron
// hit: the "Repurpose existing content" backlog (social-workflow-drip.ts)
// and the platform → studio import backlog (social-workflow-import.ts).
// Vercel's cron authenticates with the CRON_SECRET bearer token.
export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) return notFoundResponse();
  const [drip, imports] = await Promise.all([
    enqueueJob("social-workflow-drip", {}, "vercel-cron"),
    enqueueJob("social-workflow-import", {}, "vercel-cron"),
  ]);
  return NextResponse.json({ drip, imports });
};
