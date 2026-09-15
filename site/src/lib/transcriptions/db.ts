import { prisma } from "@/lib/prisma";

export type TranscriptionSourceType = "upload" | "record" | "social" | "source";

type CreateTranscriptionBase = {
  userId: string;
  sourceType: TranscriptionSourceType;
  sourceLabel: string;
  fileMime?: string;
  fileSizeBytes?: number;
  language?: string;
  tagAudioEvents: boolean;
  noVerbatim: boolean;
  diarize: boolean;
  keyterms: string[];
};

export type CreateTranscriptionInput =
  | (CreateTranscriptionBase & { status: "succeeded"; transcript: string })
  | (CreateTranscriptionBase & { status: "failed"; errorMessage: string });

/** Record a finished (succeeded or failed) Speech to Text run — called once,
 * right after the run settles client-side (see
 * cut/lib/transcriptionPersist.ts). */
export async function createTranscriptionGeneration(input: CreateTranscriptionInput): Promise<{ id: string }> {
  return prisma.transcriptionGeneration.create({
    data: {
      diarize: input.diarize,
      errorMessage: input.status === "failed" ? input.errorMessage : null,
      fileMime: input.fileMime,
      fileSizeBytes: input.fileSizeBytes,
      keyterms: input.keyterms,
      language: input.language,
      noVerbatim: input.noVerbatim,
      sourceLabel: input.sourceLabel,
      sourceType: input.sourceType,
      status: input.status,
      tagAudioEvents: input.tagAudioEvents,
      transcript: input.status === "succeeded" ? input.transcript : null,
      userId: input.userId,
    },
    select: { id: true },
  });
}
