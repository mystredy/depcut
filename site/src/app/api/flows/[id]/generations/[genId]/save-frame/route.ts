import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow } from "@/lib/flows/db";
import { saveFrameAsAsset } from "@/lib/flows/submit";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string; genId: string }> };

const saveFrameSchema = z.object({ atSeconds: z.number().min(0) }).strict();

// Save Frame — capture one frame from this (completed) video and land it as
// a new, unbilled image asset in the same Flow.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = saveFrameSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const result = await saveFrameAsAsset(request.donkey.userId, id, genId, parsed.data.atSeconds);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't save that frame.";
    return NextResponse.json({ error: "Save frame failed", message }, { status: 502 });
  }
});
