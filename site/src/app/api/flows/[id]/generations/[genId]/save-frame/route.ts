import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { ownedFlow } from "@/lib/flows/db";
import { saveFrameAsAsset } from "@/lib/flows/submit";

export const dynamic = "force-dynamic";

// A shared value with every other long-running route: Vercel bundles routes
// with matching duration configs into one function and splits mismatched
// ones apart, and this project is already at the Hobby plan's serverless
// function count ceiling — a stray distinct value here is its own function.
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string; genId: string }> };

const saveFrameSchema = z.object({ atSeconds: z.number().min(0) }).strict();

// Save Frame — capture one frame from this (completed) video and land it as
// a new, unbilled image asset in the same Flow.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = saveFrameSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  try {
    const result = await saveFrameAsAsset(request.depcut.userId, id, genId, parsed.data.atSeconds);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't save that frame.";
    return NextResponse.json({ error: "Save frame failed", message }, { status: 502 });
  }
});
