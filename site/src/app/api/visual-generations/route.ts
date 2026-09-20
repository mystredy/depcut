import { NextResponse } from "next/server";
import { z } from "zod";

import { createVisualGeneration, listVisualGenerations } from "@/lib/visualGenerations/db";
import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { resolveInferenceBlobs } from "@/lib/inference/blobs";
import type { JsonValue } from "@/lib/inference/providers";

export const dynamic = "force-dynamic";

// The signed-in user's own durable Text to Video history.
export const GET = withDepCutAuth(async (request) => {
  const generations = await listVisualGenerations(request.depcut.userId);
  return NextResponse.json({ generations });
});

const baseSchema = {
  prompt: z.string().trim().min(1).max(4_000),
  aspect: z.string().max(20),
  tier: z.string().max(50),
};

const createSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...baseSchema,
      status: z.literal("succeeded"),
      dataBase64: z.string().min(1),
      mimeType: z.string().min(1).max(100),
      durationSeconds: z.number().min(0).optional(),
    })
    .strict(),
  z
    .object({
      ...baseSchema,
      status: z.literal("failed"),
      errorMessage: z.string().min(1).max(2_000),
    })
    .strict(),
]);

// Called once per take, right after a Text to Video render settles
// client-side (see cut/lib/visualGenerationPersist.ts). Best-effort from the
// caller's side: a failure here never blocks the user from seeing or
// downloading their own render.
export const POST = withDepCutAuth(async (request) => {
  // A rendered video travels as a stored-blob placeholder rather than
  // inline base64 once past MIN_OFFLOAD_BYTES — see hostedBlobs.ts. Resolve
  // it back to dataBase64 before validating; a small payload that never got
  // offloaded passes through unchanged.
  const raw = (await request.json()) as JsonValue;
  const resolved = await resolveInferenceBlobs(raw, request.depcut.userId);
  const parsed = createSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  if (body.status === "failed") {
    const row = await createVisualGeneration({
      aspect: body.aspect,
      errorMessage: body.errorMessage,
      prompt: body.prompt,
      status: "failed",
      tier: body.tier,
      userId: request.depcut.userId,
    });
    return NextResponse.json(row, { status: 201 });
  }

  const bytes = Buffer.from(body.dataBase64, "base64");
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Invalid request", message: "Empty media." }, { status: 400 });
  }

  const row = await createVisualGeneration({
    aspect: body.aspect,
    bytes,
    durationSeconds: body.durationSeconds,
    mime: body.mimeType,
    prompt: body.prompt,
    status: "succeeded",
    tier: body.tier,
    userId: request.depcut.userId,
  });
  return NextResponse.json(row, { status: 201 });
});
