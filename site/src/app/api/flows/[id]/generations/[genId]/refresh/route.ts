import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow } from "@/lib/flows/db";
import { refreshFlowGeneration } from "@/lib/flows/submit";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; genId: string }> };

// Poll one in-flight video render — the thread view calls this on a timer
// for any generation still "in_progress".
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  try {
    const outcome = await refreshFlowGeneration(request.headers, id, genId, request.donkey.userId);
    return NextResponse.json(outcome);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't check on that generation.";
    return NextResponse.json({ error: "Refresh failed", message }, { status: 502 });
  }
});
