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
 * cut/lib/transcriptionPersist.ts), or server-side right after the Telegram
 * bot's Transcript action settles (see lib/telegram/commands.ts). */
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

export type TranscriptionGenerationRow = {
  id: string;
  sourceType: string;
  sourceLabel: string;
  status: string;
  transcript: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

/** The signed-in user's own durable transcription history — every run
 * counted here regardless of whether it came from the Speech to Text page
 * or the Telegram bot's Transcript button, both of which call
 * createTranscriptionGeneration above. */
export async function listTranscriptionGenerations(userId: string): Promise<TranscriptionGenerationRow[]> {
  return prisma.transcriptionGeneration.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      errorMessage: true,
      id: true,
      sourceLabel: true,
      sourceType: true,
      status: true,
      transcript: true,
    },
    take: HISTORY_LIMIT,
    where: { userId },
  });
}

/** Deletes one row, scoped to its owner — returns whether a row actually
 * matched (false if it didn't exist or belonged to someone else). */
export async function deleteTranscriptionGeneration(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.transcriptionGeneration.deleteMany({ where: { id, userId } });
  return count > 0;
}
