import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { createTranscriptionGeneration } from "@/lib/transcriptions/db";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    sourceType: z.enum(["upload", "record", "social", "source"]),
    sourceLabel: z.string().trim().min(1).max(500),
    fileMime: z.string().max(100).optional(),
    fileSizeBytes: z.number().int().min(0).optional(),
    language: z.string().max(20).optional(),
    tagAudioEvents: z.boolean(),
    noVerbatim: z.boolean(),
    diarize: z.boolean(),
    keyterms: z.array(z.string().max(50)).max(50),
    status: z.enum(["succeeded", "failed"]),
    transcript: z.string().max(200_000).optional(),
    errorMessage: z.string().max(2_000).optional(),
  })
  .strict()
  .refine((data) => (data.status === "succeeded" ? !!data.transcript : !!data.errorMessage), {
    message: "transcript is required when succeeded, errorMessage is required when failed",
    path: ["transcript"],
  });

// Called once, right after a Speech to Text run settles client-side (see
// cut/lib/transcriptionPersist.ts).
export const POST = withDepCutAuth(async (request) => {
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const body = parsed.data;

  const row = await createTranscriptionGeneration(
    body.status === "succeeded"
      ? {
          diarize: body.diarize,
          fileMime: body.fileMime,
          fileSizeBytes: body.fileSizeBytes,
          keyterms: body.keyterms,
          language: body.language,
          noVerbatim: body.noVerbatim,
          sourceLabel: body.sourceLabel,
          sourceType: body.sourceType,
          status: "succeeded",
          tagAudioEvents: body.tagAudioEvents,
          transcript: body.transcript!,
          userId: request.depcut.userId,
        }
      : {
          diarize: body.diarize,
          errorMessage: body.errorMessage!,
          fileMime: body.fileMime,
          fileSizeBytes: body.fileSizeBytes,
          keyterms: body.keyterms,
          language: body.language,
          noVerbatim: body.noVerbatim,
          sourceLabel: body.sourceLabel,
          sourceType: body.sourceType,
          status: "failed",
          tagAudioEvents: body.tagAudioEvents,
          userId: request.depcut.userId,
        },
  );
  return NextResponse.json(row, { status: 201 });
});
