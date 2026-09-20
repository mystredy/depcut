import { audioGenerationKey, presignGetDownload } from "@/cut/server/cloud/r2";
import { audioGenerationUrl } from "@/lib/audioGenerations/media";
import { safeExportName } from "@/lib/exportFilename";
import { prisma } from "@/lib/prisma";
import { delStrict, putObject } from "@/cut/server/cloud/r2";

export type AudioTool = "text-to-speech" | "dubbing";

/** Duration from a WAV file's own header (0 when it doesn't look like a WAV
 * this can read) — every clip here comes from tts.ts's own assembleWav, a
 * fixed 44-byte PCM header, so no need for ffprobe the way Flow's arbitrary
 * provider video output needs it (see cut/server/frames.ts). */
export function wavDurationSeconds(bytes: Buffer): number {
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
  script: string;
  direction?: string;
  voice: string;
  language?: string;
  bytes: Buffer;
  mime: string;
  durationSeconds?: number;
};

/** Upload the already-rendered clip to R2 and record the row — called once,
 * right after a Text to Speech render succeeds client-side (see
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
      script: input.script,
      direction: input.direction,
      voice: input.voice,
      language: input.language,
      outputKey: key,
      outputMime: input.mime,
      durationSeconds: input.durationSeconds ?? (wavDurationSeconds(input.bytes) || null),
    },
    select: { id: true },
  });
  return row;
}

export type AudioGenerationRow = {
  id: string;
  script: string;
  direction: string | null;
  voice: string;
  language: string | null;
  outputUrl: string;
  downloadUrl: string;
  outputMime: string;
  durationSeconds: number | null;
  createdAt: Date;
};

const HISTORY_LIMIT = 50;

/** The signed-in user's own Text to Speech history. */
export async function listAudioGenerations(userId: string): Promise<AudioGenerationRow[]> {
  const rows = await prisma.audioGeneration.findMany({
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    where: { userId },
  });
  return Promise.all(
    rows.map(async (r) => {
      const ext = r.outputMime.includes("wav") ? "wav" : "bin";
      const filename = `${safeExportName(r.script)}.${ext}`;
      return {
        createdAt: r.createdAt,
        direction: r.direction,
        downloadUrl: await presignGetDownload(r.outputKey, filename),
        durationSeconds: r.durationSeconds,
        id: r.id,
        language: r.language,
        outputMime: r.outputMime,
        outputUrl: await audioGenerationUrl(r.outputKey),
        script: r.script,
        voice: r.voice,
      };
    }),
  );
}

export type DeleteGenerationResult = "deleted" | "not_found" | "storage_error";

/** The R2 object goes first (see flows' generation DELETE for the same
 * order) — the row is only removed once it's confirmed gone, so a storage
 * failure leaves the row in place and the same delete is safely retryable. */
export async function deleteAudioGeneration(userId: string, id: string): Promise<DeleteGenerationResult> {
  const row = await prisma.audioGeneration.findFirst({ select: { outputKey: true }, where: { id, userId } });
  if (!row) return "not_found";
  const { failed } = await delStrict([row.outputKey]);
  if (failed.length > 0) return "storage_error";
  await prisma.audioGeneration.delete({ where: { id } });
  return "deleted";
}

export type AudioGenerationView = {
  id: string;
  userId: string;
  tool: AudioTool;
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
 * Audio list. `tool` narrows to just Text to Speech or just Dubbing; "All"
 * (tool omitted) merges both tables in application code and re-sorts, since
 * each tool now owns its own table (AudioGeneration/DubbingGeneration) —
 * there is no single table left to query and page directly. */
export async function listAudioGenerationsForAdmin(tool?: AudioTool): Promise<AudioGenerationView[]> {
  const [audioRows, dubbingRows] = await Promise.all([
    tool === "dubbing"
      ? []
      : prisma.audioGeneration.findMany({ orderBy: { createdAt: "desc" }, take: ADMIN_PAGE_SIZE }),
    tool === "text-to-speech"
      ? []
      : prisma.dubbingGeneration.findMany({ orderBy: { createdAt: "desc" }, take: ADMIN_PAGE_SIZE }),
  ]);

  const merged = [
    ...audioRows.map((r) => ({ ...r, tool: "text-to-speech" as const, sourceLabel: null, transcript: null, targetLanguage: null })),
    ...dubbingRows.map((r) => ({ ...r, tool: "dubbing" as const })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, ADMIN_PAGE_SIZE);

  return Promise.all(
    merged.map(async (r) => ({
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
