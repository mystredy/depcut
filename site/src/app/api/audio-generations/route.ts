import { NextResponse } from "next/server";
import { z } from "zod";

import { createAudioGeneration } from "@/lib/audioGenerations/db";
import { withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    tool: z.enum(["text-to-speech", "dubbing"]),
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

// Called once, right after a Text to Speech or Dubbing render finishes
// successfully client-side (renderSpeechClip already has the finished WAV in
// hand) — see cut/lib/audioGenerationPersist.ts. Best-effort from the
// caller's side: a failure here never blocks the user from hearing or
// downloading their own clip, it just means that render won't show up in the
// admin's Content → Audio list.
export const POST = withDepCutAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;
  const bytes = Buffer.from(body.dataBase64, "base64");
  if (bytes.length === 0) {
    return NextResponse.json({ error: "Invalid request", message: "Empty clip." }, { status: 400 });
  }

  const row = await createAudioGeneration({
    userId: request.depcut.userId,
    tool: body.tool,
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
