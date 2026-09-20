import { NextResponse } from "next/server";
import { z } from "zod";

import { createDubbingGeneration, listDubbingGenerations } from "@/lib/dubbingGenerations/db";
import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { resolveInferenceBlobs } from "@/lib/inference/blobs";
import type { JsonValue } from "@/lib/inference/providers";

export const dynamic = "force-dynamic";

// The signed-in user's own durable Dubbing history.
export const GET = withDepCutAuth(async (request) => {
  const generations = await listDubbingGenerations(request.depcut.userId);
  return NextResponse.json({ generations });
});

const createSchema = z
  .object({
    script: z.string().trim().min(1).max(20_000),
    direction: z.string().max(2_000).optional(),
    voice: z.string().min(1).max(100),
    language: z.string().max(20).optional(),
    sourceLabel: z.string().max(500).optional(),
    transcript: z.string().max(20_000).optional(),
    targetLanguage: z.string().max(20).optional(),
    dataBase64: z.string().min(1),
    mimeType: z.string().min(1).max(100),
  })
  .strict();

// Called once, right after a Dubbing render finishes successfully
// client-side (renderSpeechClip already has the finished WAV in hand) — see
// cut/lib/dubbingGenerationPersist.ts. Best-effort from the caller's side: a
// failure here never blocks the user from hearing or downloading their own
// clip, it just means that render won't show up in the admin's Content →
// Audio list.
export const POST = withDepCutAuth(async (request) => {
  // A long clip travels as a stored-blob placeholder rather than inline
  // base64 once past MIN_OFFLOAD_BYTES — see hostedBlobs.ts. Resolve it back
  // to dataBase64 before validating; a small payload that never got
  // offloaded passes through unchanged.
  const raw = (await request.json()) as JsonValue;
  const resolved = await resolveInferenceBlobs(raw, request.depcut.userId);
  const parsed = createSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  const bytes = Buffer.from(body.dataBase64, "base64");
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Invalid request", message: "Empty clip." }, { status: 400 });
  }

  const row = await createDubbingGeneration({
    userId: request.depcut.userId,
    script: body.script,
    direction: body.direction,
    voice: body.voice,
    language: body.language,
    sourceLabel: body.sourceLabel,
    transcript: body.transcript,
    targetLanguage: body.targetLanguage,
    bytes,
    mime: body.mimeType,
  });
  return NextResponse.json(row, { status: 201 });
});
