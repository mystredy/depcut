import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { download } from "../server/urlDownload";
import { prisma, type ClaimedJob } from "./db";
import { mimeFor, submissionVerificationKey, submissionVideoKey, uploadFile } from "./r2";

/**
 * Pulls the video a Submit Project YouTube match points at (see
 * /api/submissions/[id]/edit-code) into the submission's video and
 * verification-export slots. Channel match and metadata (title,
 * description, tags, watermark) are already set synchronously by the
 * hosted route before this job is even queued — the video needs yt-dlp,
 * which only runs here, not on Vercel (see urlDownload.ts).
 *
 * Transcription is a separate step the client triggers once this job's
 * result lands (POST /api/submissions/[id]/edit-code/transcribe) — it
 * bills the artist's inference credits, which depends on Next's request
 * context and isn't available in this plain Node process.
 */
export async function runSubmissionYoutubeJob(job: ClaimedJob): Promise<{ videoPulled: boolean }> {
  const { url, submissionId } = (job.spec ?? {}) as { url?: string; submissionId?: string };
  if (!url || !submissionId) throw new Error("Missing url or submissionId.");

  const tmp = await mkdtemp(path.join(os.tmpdir(), "submission-yt-"));
  try {
    const dl = await download(url.trim(), tmp);
    const file = dl.files[0];
    if (!file) throw new Error("Nothing downloadable was found at that URL.");

    const fileName = path.basename(file.file);
    const mime = mimeFor(fileName);
    const videoKey = submissionVideoKey(job.userId, submissionId, fileName);
    const verificationKey = submissionVerificationKey(job.userId, submissionId, fileName);

    await uploadFile(videoKey, file.file, mime);
    await uploadFile(verificationKey, file.file, mime);

    await prisma.$transaction([
      prisma.submissionAsset.upsert({
        where: { submissionId_type: { submissionId, type: "video" } },
        create: { submissionId, type: "video", fileName, storageKey: videoKey, status: "complete" },
        update: { error: null, fileName, status: "complete", storageKey: videoKey },
      }),
      prisma.submissionAsset.upsert({
        where: { submissionId_type: { submissionId, type: "verification" } },
        create: { submissionId, type: "verification", fileName, storageKey: verificationKey, status: "complete" },
        update: { error: null, fileName, status: "complete", storageKey: verificationKey },
      }),
    ]);

    return { videoPulled: true };
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}
