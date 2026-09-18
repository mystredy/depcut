import { NextRequest, NextResponse } from "next/server";

import { isVercelCron, notFoundResponse } from "@/lib/depcut-api-auth";
import { enqueueJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The bi-weekly artist Rates payout sweep — moves earnings from the
// half-month window that closed one cycle ago out of pending and into
// available (see artistRatesSweep.ts). Runs on the 1st and 16th
// (vercel.json); Vercel's cron authenticates with the project's
// CRON_SECRET bearer token, same convention as /api/drops/schedule/run.
export const GET = async (request: NextRequest) => {
  if (!isVercelCron(request)) return notFoundResponse();
  const sweep = await enqueueJob("artist-rates-sweep", {}, "vercel-cron");
  return NextResponse.json({ sweep });
};
