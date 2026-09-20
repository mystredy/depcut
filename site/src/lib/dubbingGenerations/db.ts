import { dubbingGenerationKey } from "@/cut/server/cloud/r2";
import { wavDurationSeconds } from "@/lib/audioGenerations/db";
import { prisma } from "@/lib/prisma";
import { delStrict, presignGet, putObject } from "@/cut/server/cloud/r2";

export type CreateDubbingGenerationInput = {
  userId: string;
  script: string;
  direction?: string;
  voice: string;
  language?: string;
  sourceLabel?: string;
  transcript?: string;
  targetLanguage?: string;
  bytes: Buffer;
  mime: string;
  durationSeconds?: number;
};

/** Upload the already-rendered clip to R2 and record the row — called once,
 * right after a Dubbing render succeeds client-side (see
 * cut/lib/dubbingGenerationPersist.ts). Never called for a failed render:
 * the client only has bytes to send once generation actually worked, so
 * unlike FlowGeneration there is no "failed" status to track here. */
export async function createDubbingGeneration(input: CreateDubbingGenerationInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const ext = input.mime.includes("wav") ? "wav" : "bin";
  const key = dubbingGenerationKey(input.userId, id, `clip.${ext}`);
  await putObject(key, input.bytes, input.mime);

  return prisma.dubbingGeneration.create({
    data: {
      id,
      userId: input.userId,
      script: input.script,
      direction: input.direction,
      voice: input.voice,
      language: input.language,
      sourceLabel: input.sourceLabel,
      transcript: input.transcript,
      targetLanguage: input.targetLanguage,
      outputKey: key,
      outputMime: input.mime,
      durationSeconds: input.durationSeconds ?? (wavDurationSeconds(input.bytes) || null),
    },
    select: { id: true },
  });
}

export type DubbingGenerationRow = {
  id: string;
  script: string;
  direction: string | null;
  voice: string;
  language: string | null;
  sourceLabel: string | null;
  transcript: string | null;
  targetLanguage: string | null;
  outputUrl: string;
  outputMime: string;
  durationSeconds: number | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

/** The signed-in user's own Dubbing history. */
export async function listDubbingGenerations(userId: string): Promise<DubbingGenerationRow[]> {
  const rows = await prisma.dubbingGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    where: { userId },
  });
  return Promise.all(
    rows.map(async (r) => ({
      createdAt: r.createdAt,
      direction: r.direction,
      durationSeconds: r.durationSeconds,
      id: r.id,
      language: r.language,
      outputMime: r.outputMime,
      outputUrl: await presignGet(r.outputKey),
      script: r.script,
      sourceLabel: r.sourceLabel,
      targetLanguage: r.targetLanguage,
      transcript: r.transcript,
      voice: r.voice,
    })),
  );
}

export type DeleteGenerationResult = "deleted" | "not_found" | "storage_error";

/** Same "storage object goes first, row only removed once it's confirmed
 * gone" order as deleteAudioGeneration. */
export async function deleteDubbingGeneration(userId: string, id: string): Promise<DeleteGenerationResult> {
  const row = await prisma.dubbingGeneration.findFirst({ select: { outputKey: true }, where: { id, userId } });
  if (!row) return "not_found";
  const { failed } = await delStrict([row.outputKey]);
  if (failed.length > 0) return "storage_error";
  await prisma.dubbingGeneration.delete({ where: { id } });
  return "deleted";
}
