import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

import { MAX_AUDIO_BYTES } from "@/cut/server/cloud/transcribe";

// Pulls a matched YouTube video's bytes for Submit Project's Pro
// Verification Suite (see /api/submissions/[id]/edit-code). This route runs
// on Vercel, which has no Python and no yt-dlp on PATH, so the binary is
// vendored at build time (scripts/fetch-yt-dlp.mjs) rather than resolved
// from the system the way the local Cut engine / cloud render worker do it
// (src/cut/server/urlDownload.ts) — kept as its own module rather than
// reusing that one since it shells out to an explicit binary path instead
// of PATH resolution, and only needs the YouTube case.
const YT_DLP_PATH = path.join(process.cwd(), "vendor", "yt-dlp", "yt-dlp");

const DOWNLOAD_TIMEOUT_MS = 120_000;
const AUDIO_EXTRACT_TIMEOUT_MS = 60_000;

function run(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("Process timed out."));
    }, timeoutMs);
    timer.unref();
    let stderr = "";
    p.stderr.on("data", (d) => (stderr = (stderr + d.toString()).slice(-2000)));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** Downloads url into destDir as "video.mp4", returning its path — null if
 * the vendored binary isn't staged (see fetch-yt-dlp.mjs's own best-effort
 * doc comment) or the download itself fails. */
export async function downloadYoutubeVideo(url: string, destDir: string): Promise<string | null> {
  const outFile = path.join(destDir, "video.mp4");
  try {
    const { code, stderr } = await run(
      YT_DLP_PATH,
      [
        "--no-playlist",
        "--no-progress",
        "-f",
        "mp4/bestvideo*+bestaudio/best",
        "--merge-output-format",
        "mp4",
        "--ffmpeg-location",
        ffmpegPath ?? "ffmpeg",
        "-o",
        outFile,
        url,
      ],
      DOWNLOAD_TIMEOUT_MS,
    );
    if (code !== 0) {
      console.error("downloadYoutubeVideo: yt-dlp failed —", stderr.split("\n").filter(Boolean).slice(-1)[0]);
      return null;
    }
    return outFile;
  } catch (e) {
    console.error("downloadYoutubeVideo: yt-dlp failed —", e instanceof Error ? e.message : e);
    return null;
  }
}

/** A compact mono audio track for transcription — well under
 * MAX_AUDIO_BYTES for anything short-form, which is what this feature
 * matches against (see matchYoutubeLink). Returns null (rather than a
 * too-large file) past that limit, so the caller skips transcription
 * instead of sending a payload the transcribe route would just reject. */
export async function extractAudioForTranscription(videoFile: string, destDir: string): Promise<Buffer | null> {
  if (!ffmpegPath) return null;
  const outFile = path.join(destDir, "audio.m4a");
  try {
    const { code } = await run(
      ffmpegPath,
      ["-y", "-i", videoFile, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "48k", outFile],
      AUDIO_EXTRACT_TIMEOUT_MS,
    );
    if (code !== 0) return null;
    const info = await stat(outFile);
    if (info.size === 0 || info.size > MAX_AUDIO_BYTES) return null;
    const { readFile } = await import("node:fs/promises");
    return readFile(outFile);
  } catch (e) {
    console.error("extractAudioForTranscription: ffmpeg failed —", e instanceof Error ? e.message : e);
    return null;
  }
}
