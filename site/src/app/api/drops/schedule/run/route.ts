import { NextRequest, NextResponse } from "next/server";

import { isVercelCron, notFoundResponse } from "@/lib/depcut-api-auth";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The scheduled-drops sweep — publishes any "scheduled" Drop whose
// scheduledFor has passed (see dropScheduleSweep.ts). Runs every ~10
// minutes (vercel.json); Vercel's cron authenticates with the project's
// CRON_SECRET bearer token, same convention as /api/social-workflows/run.
export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) return notFoundResponse();
  const sweep = await enqueueJob("drop-schedule-sweep", {}, "vercel-cron");
  return NextResponse.json({ sweep });
};
