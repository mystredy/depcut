// Stages yt-dlp's standalone Linux binary (no system Python needed — it's a
// PyInstaller build) for the Submit Project YouTube-match video pull (see
// src/lib/marketplace/youtubeDownload.ts). Vercel's Node serverless runtime
// has no Python and no package manager to install yt-dlp with, so this
// fetches the binary directly from its GitHub release at build time, the
// same "stage into a local path on install" approach copy-mediapipe-assets.mjs
// already uses for a different vendored asset.
//
// Linux-only and Vercel-only on purpose: local dev runs on this machine's
// own OS (this binary wouldn't execute there anyway), and every other
// deploy target that isn't Vercel doesn't need it. Failure here doesn't fail
// the install — the video pull is already a best-effort feature at runtime
// (see matchYoutubeLink's own doc comment); a missing binary just means it
// skips the same way a download failure would.
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// Kept in step with YT_DLP_PATH in src/lib/marketplace/youtubeDownload.ts —
// this script only stages the file, that module is what reads it at runtime.
const YT_DLP_PATH = path.join(root, "vendor", "yt-dlp", "yt-dlp");

async function main() {
  if (!process.env.VERCEL) {
    console.log("fetch-yt-dlp: not on Vercel; skipping");
    return;
  }
  if (existsSync(YT_DLP_PATH)) {
    console.log("fetch-yt-dlp: already staged; skipping");
    return;
  }
  const url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    mkdirSync(path.dirname(YT_DLP_PATH), { recursive: true });
    writeFileSync(YT_DLP_PATH, bytes);
    chmodSync(YT_DLP_PATH, 0o755);
    console.log(`fetch-yt-dlp: staged ${bytes.length} bytes to ${YT_DLP_PATH}`);
  } catch (e) {
    console.warn("fetch-yt-dlp: could not fetch yt-dlp binary; video pull will be skipped —", e);
  }
}

await main();
