import { audioGenerationKey } from "@/cut/server/cloud/r2";
import { audioGenerationUrl } from "@/lib/audioGenerations/media";
import { prisma } from "@/lib/prisma";
import { putObject } from "@/cut/server/cloud/r2";

export type AudioTool = "text-to-speech" | "dubbing";

/** Duration from a WAV file's own header (0 when it doesn't look like a WAV
 * this can read) — every clip here comes from tts.ts's own assembleWav, a
 * fixed 44-byte PCM header, so no need for ffprobe the way Flow's arbitrary
 * provider video output needs it (see cut/server/frames.ts). */
function wavDurationSeconds(bytes: Buffer): number {
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    return 0;
  }
  const channels = bytes.readUInt16LE(22);
  const sampleRate = bytes.readUInt32LE(24);
  const bitsPerSample = bytes.readUInt16LE(34);
  const dataBytes = bytes.readUInt32LE(40);
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  return bytesPerSecond > 0 ? dataBytes / bytesPerSecond : 0;
}

export type CreateAudioGenerationInput = {
  userId: string;
  tool: AudioTool;
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
 * right after a Text to Speech or Dubbing render succeeds client-side (see
 * cut/lib/audioGenerationPersist.ts). Never called for a failed render: the
 * client only has bytes to send once generation actually worked, so unlike
 * FlowGeneration there is no "failed" status to track here. */
export async function createAudioGeneration(input: CreateAudioGenerationInput): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const ext = input.mime.includes("wav") ? "wav" : "bin";
  const key = audioGenerationKey(input.userId, id, `clip.${ext}`);
  await putObject(key, input.bytes, input.mime);

  const row = await prisma.audioGeneration.create({
    data: {
      id,
      userId: input.userId,
      tool: input.tool,
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
  return row;
}

export type AudioGenerationView = {
  id: string;
  userId: string;
  tool: string;
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

const ADMIN_PAGE_SIZE = 50;

/** Most recent audio generations across every account — the admin Content →
 * Audio list. `tool` narrows to just Text to Speech or just Dubbing rows. */
export async function listAudioGenerationsForAdmin(tool?: AudioTool): Promise<AudioGenerationView[]> {
  const rows = await prisma.audioGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: ADMIN_PAGE_SIZE,
    where: tool ? { tool } : undefined,
  });
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      userId: r.userId,
      tool: r.tool,
      script: r.script,
      direction: r.direction,
      voice: r.voice,
      language: r.language,
      sourceLabel: r.sourceLabel,
      transcript: r.transcript,
      targetLanguage: r.targetLanguage,
      outputUrl: await audioGenerationUrl(r.outputKey),
      outputMime: r.outputMime,
      durationSeconds: r.durationSeconds,
      createdAt: r.createdAt,
    }))
  );
}
