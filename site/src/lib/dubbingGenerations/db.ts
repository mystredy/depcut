import { dubbingGenerationKey } from "@/cut/server/cloud/r2";
import { wavDurationSeconds } from "@/lib/audioGenerations/db";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/cut/server/cloud/r2";

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
