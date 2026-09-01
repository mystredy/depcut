import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mediaPath } from "./projects";
import { num, round } from "./util";

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after 60s.`));
    }, 60_000);
    timer.unref();
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-2000)));
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(
        e.message.includes("ENOENT")
          ? new Error("ffmpeg was not found. Install it with: brew install ffmpeg")
          : e
      );
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error(err.split("\n").slice(-3).join("\n")));
    });
  });
}

export function probeDims(file: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0",
      file,
    ]);
    let out = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve({ width: 1080, height: 1920 });
    }, 30_000);
    timer.unref();
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      clearTimeout(timer);
      const [w, h] = out.trim().split(",").map(Number);
      resolve({ width: w || 1080, height: h || 1920 });
    });
    p.on("error", () => {
      clearTimeout(timer);
      resolve({ width: 1080, height: 1920 });
    });
  });
}

export interface FreezeFraming {
  fit: "fit" | "fill";
  panX: number;
  panY: number;
}

/**
 * Render a still-video clip from one frame of a project media file
 * (a freeze frame), written into the project's media folder.
 *
 * When `frame` is given the still is composited exactly as the preview shows
 * it — letterboxed (fit) or crop-panned (fill) into the project frame — so
 * the capture is locked to the aspect at capture time. Switching the project
 * aspect later letterboxes the baked still; capture another to re-fit.
 */
export async function makeFreezeFrame(
  projectId: string,
  sourceFile: string,
  srcTime: number,
  duration: number,
  frame?: { w: number; h: number },
  framing?: FreezeFraming
): Promise<{ fileName: string; duration: number; width: number; height: number }> {
  const src = mediaPath(projectId, sourceFile);
  const dur = Math.min(10, Math.max(0.5, duration));
  const stampTime = Math.max(0, srcTime);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "veditor-freeze-"));
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fileName = `freeze-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${crypto.randomUUID().slice(0, 4)}.mp4`;
  try {
    const png = path.join(tmp, "frame.png");
    await run("ffmpeg", ["-y", "-ss", stampTime.toFixed(3), "-i", src, "-frames:v", "1", png]);

    let vf: string | null = null;
    if (frame) {
      const { w, h } = frame;
      if (framing?.fit === "fill") {
        // Same crop-window math as the preview canvas: pan -1..1 → 0..1.
        const kx = (0.5 + (framing.panX ?? 0) / 2).toFixed(4);
        const ky = (0.5 + (framing.panY ?? 0) / 2).toFixed(4);
        vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)*${kx}:(ih-oh)*${ky}`;
      } else {
        vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black`;
      }
    }

    await run("ffmpeg", [
      "-y",
      "-loop", "1",
      "-i", png,
      "-t", dur.toFixed(3),
      "-r", "30",
      ...(vf ? ["-vf", vf] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      mediaPath(projectId, fileName),
    ]);
    if (frame) return { fileName, duration: dur, width: frame.w, height: frame.h };
    const dims = await probeDims(png);
    return { fileName, duration: dur, width: dims.width, height: dims.height };
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}

/** Extract one JPEG frame from raw video bytes — for a source that isn't a
 * project media file on disk (see Flow's own video generations, which land
 * straight in R2), so this writes to a temp file itself rather than reading
 * through mediaPath. Used for a Flow video's poster frame. */
export async function extractPosterFrame(bytes: Buffer, atSeconds = 0.5): Promise<Buffer> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "poster-"));
  try {
    const src = path.join(tmp, "source");
    await writeFile(src, bytes);
    const out = path.join(tmp, "frame.jpg");
    await run("ffmpeg", ["-y", "-ss", atSeconds.toFixed(3), "-i", src, "-frames:v", "1", "-q:v", "3", out]);
    return await readFile(out);
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}

/** Whether a media file has an audio stream at all — AI-generated clips
 * don't reliably carry one, and ffmpeg's concat filter mapping an audio pad
 * that doesn't exist fails the whole render, so Scene Builder's export
 * checks this across every clip first (see concatVideoClips). */
function probeHasAudio(file: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", [
      "-v", "error",
      "-select_streams", "a",
      "-show_entries", "stream=index",
      "-of", "csv=p=0",
      file,
    ]);
    let out = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve(false);
    }, 15_000);
    timer.unref();
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      clearTimeout(timer);
      resolve(out.trim().length > 0);
    });
    p.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/**
 * Concatenate Scene Builder's trimmed clips into one MP4 — every clip
 * re-encoded to a common resolution (the first clip's) and framerate before
 * concatenation, since AI-generated clips have no guarantee of matching
 * dimensions or codecs the way a stream-copy concat would require. Audio
 * only rides along if every clip has a track; one silent clip drops audio
 * from the whole export rather than failing the render.
 */
export async function concatVideoClips(
  clips: { bytes: Buffer; trimInSeconds?: number | null; trimOutSeconds?: number | null }[]
): Promise<Buffer> {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "scene-"));
  try {
    const files = await Promise.all(
      clips.map(async (c, i) => {
        const p = path.join(tmp, `clip-${i}.mp4`);
        await writeFile(p, c.bytes);
        return p;
      })
    );
    const dims = await probeDims(files[0]);
    const hasAudio = await Promise.all(files.map(probeHasAudio));
    const withAudio = hasAudio.every(Boolean);

    const inputArgs: string[] = [];
    const filterParts: string[] = [];
    files.forEach((file, i) => {
      const trimIn = clips[i].trimInSeconds ?? 0;
      const trimOut = clips[i].trimOutSeconds ?? undefined;
      if (trimIn > 0) inputArgs.push("-ss", trimIn.toFixed(3));
      if (trimOut !== undefined) inputArgs.push("-t", Math.max(0.1, trimOut - trimIn).toFixed(3));
      inputArgs.push("-i", file);
      filterParts.push(
        `[${i}:v]scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease,pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30[v${i}]`
      );
      if (withAudio) filterParts.push(`[${i}:a]aresample=async=1[a${i}]`);
    });
    const concatInputs = files.map((_, i) => (withAudio ? `[v${i}][a${i}]` : `[v${i}]`)).join("");
    filterParts.push(
      `${concatInputs}concat=n=${files.length}:v=1:a=${withAudio ? 1 : 0}[outv]${withAudio ? "[outa]" : ""}`
    );
    const out = path.join(tmp, "scene.mp4");
    await run("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex", filterParts.join(";"),
      "-map", "[outv]",
      ...(withAudio ? ["-map", "[outa]"] : []),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      ...(withAudio ? ["-c:a", "aac"] : []),
      out,
    ]);
    return await readFile(out);
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}

/** Media duration in seconds via ffprobe (0 when unknown). */
export function probeDuration(file: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "csv=p=0",
      file,
    ]);
    let out = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve(0);
    }, 30_000);
    timer.unref();
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => {
      clearTimeout(timer);
      resolve(parseFloat(out) || 0);
    });
    p.on("error", () => {
      clearTimeout(timer);
      resolve(0);
    });
  });
}

interface CaptureRun {
  ok: boolean;
  timedOut: boolean;
  stderr: string;
}

/** Run ffmpeg keeping the whole stderr — the frame/silence reports stream
 * there. A timeout resolves instead of rejecting so callers can salvage
 * partial output; a missing binary still maps to the install hint. */
function runCapture(args: string[], timeoutMs: number): Promise<CaptureRun> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args);
    let err = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill("SIGKILL");
    }, timeoutMs);
    timer.unref();
    p.stderr.on("data", (d) => {
      if (err.length < 2_000_000) err += d.toString();
    });
    p.on("error", (e) => {
      clearTimeout(timer);
      reject(
        e.message.includes("ENOENT")
          ? new Error("ffmpeg was not found. Install it with: brew install ffmpeg")
          : e
      );
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0 && !timedOut, timedOut, stderr: err });
    });
  });
}

const errTail = (stderr: string) => stderr.trim().split("\n").slice(-3).join("\n");

const sheetDataUrl = async (file: string) =>
  `data:image/jpeg;base64,${(await readFile(file)).toString("base64")}`;

const SHEET_GRID = 3; // cells per row and column
const SHEET_CELL = 480; // cell long side, px
const SHEET_GAP = 4; // tile margin and padding, px — the client stamps cells by this geometry
const SCENE_THRESHOLD = 0.3; // ffmpeg scene-score cut point
const WATCH_BUDGET_MS = 100_000; // all attempts together; leaves salvage room under the 120s tool cap

export interface SheetFrame {
  t: number;
  scene?: number;
}

export interface WatchResult {
  sheets: { image: string; frames: SheetFrame[] }[];
  /** Cell geometry, so the client can stamp each cell with its time. */
  layout: { grid: number; margin: number; padding: number };
  sceneChanges: number[];
  coveredTo: number;
  truncated: boolean;
}

/**
 * Sample a media file into timestamped contact sheets: frames picked at scene
 * changes plus a steady density floor, each cell stamped with its source time,
 * tiled 3×3. This is how the assistant watches footage — a bounded survey of
 * what the file actually shows (maxSheets per call; callers narrow the range
 * to see more).
 */
export async function makeContactSheets(
  projectId: string,
  sourceFile: string,
  opts: { from: number; to: number; interval: number; maxSheets: number; still?: boolean }
): Promise<WatchResult> {
  const src = mediaPath(projectId, sourceFile);
  const tmp = await mkdtemp(path.join(os.tmpdir(), "veditor-watch-"));
  try {
    const dims = await probeDims(src);
    const scale = dims.width >= dims.height ? `scale=${SHEET_CELL}:-2` : `scale=-2:${SHEET_CELL}`;

    // A still is its own one-cell sheet — no sampling, no time axis.
    if (opts.still) {
      const out = path.join(tmp, "sheet-01.jpg");
      const r = await runCapture(
        ["-hide_banner", "-nostats", "-y", "-i", src, "-vf", scale, "-frames:v", "1", "-q:v", "5", out],
        30_000
      );
      if (!r.ok) throw new Error(errTail(r.stderr) || "Could not read the image.");
      return {
        sheets: [{ image: await sheetDataUrl(out), frames: [{ t: 0 }] }],
        layout: { grid: 1, margin: 0, padding: 0 },
        sceneChanges: [],
        coveredTo: 0,
        truncated: false,
      };
    }

    const { from, to, interval, maxSheets } = opts;
    const minGap = Math.max(0.4, interval / 3);
    const graph = [
      // First frame always; a scene cut once minGap has passed; the floor.
      `select='isnan(prev_selected_t)+gt(scene,${SCENE_THRESHOLD})*gte(t-prev_selected_t,${num(minGap)})+gte(t-prev_selected_t,${num(interval)})'`,
      "metadata=print",
      scale,
      `tile=${SHEET_GRID}x${SHEET_GRID}:padding=${SHEET_GAP}:margin=${SHEET_GAP}`,
    ].join(",");
    const args = (hw: boolean) => [
      "-hide_banner", "-nostats", "-loglevel", "info", "-y",
      ...(hw ? ["-hwaccel", "videotoolbox"] : []),
      "-ss", num(from),
      "-t", num(to - from),
      "-i", src,
      "-map", "0:v:0", "-an", "-sn", "-dn",
      "-vf", graph,
      "-fps_mode", "vfr",
      "-frames:v", String(maxSheets),
      "-q:v", "5",
      path.join(tmp, "sheet-%02d.jpg"),
    ];

    // Hardware decode first; a source it refuses gets one software retry.
    const deadline = Date.now() + WATCH_BUDGET_MS;
    let run = await runCapture(args(true), WATCH_BUDGET_MS);
    if (!run.ok && !run.timedOut && deadline - Date.now() > 5_000) {
      // Await every stale-sheet delete before the retry writes new sheets to the
      // same paths, or a slow unlink can land after ffmpeg and wipe a fresh sheet.
      await Promise.all(
        (await readdir(tmp)).map((f) => unlink(path.join(tmp, f)).catch(() => {})),
      );
      run = await runCapture(args(false), deadline - Date.now());
    }

    const files = (await readdir(tmp)).filter((f) => f.endsWith(".jpg")).sort();
    // A timeout or a mid-run decode error may leave the last sheet half-written.
    if (!run.ok && files.length > 0) files.pop();
    if (files.length === 0) {
      throw new Error(
        run.timedOut
          ? "Sampling timed out before the first sheet was ready — try a shorter range or a larger interval."
          : errTail(run.stderr) || "Could not sample the video."
      );
    }

    // metadata=print logs each selected frame ("frame:N … pts_time:T" then
    // "lavfi.scene_score=S"); times are relative to the input seek.
    const frames: SheetFrame[] = [];
    for (const line of run.stderr.split("\n")) {
      const t = /frame:\d+.*pts_time:([\d.]+)/.exec(line);
      if (t) {
        frames.push({ t: round(from + parseFloat(t[1])) });
        continue;
      }
      const s = /lavfi\.scene_score=([\d.]+)/.exec(line);
      if (s && frames.length > 0) frames[frames.length - 1].scene = parseFloat(s[1]);
    }
    const perSheet = SHEET_GRID * SHEET_GRID;
    const kept = frames.slice(0, files.length * perSheet);
    const sheets = await Promise.all(
      files.map(async (f, i) => ({
        image: await sheetDataUrl(path.join(tmp, f)),
        frames: kept.slice(i * perSheet, (i + 1) * perSheet),
      }))
    );
    const lastT = kept.length > 0 ? kept[kept.length - 1].t : from;
    // An aborted run (timeout or error) that salvaged sheets covered only what
    // it decoded — never claim the full range for it.
    const truncated =
      (!run.ok || frames.length >= maxSheets * perSheet) && lastT < to - interval;
    return {
      sheets,
      layout: { grid: SHEET_GRID, margin: SHEET_GAP, padding: SHEET_GAP },
      sceneChanges: kept.filter((f) => (f.scene ?? 0) >= SCENE_THRESHOLD).map((f) => f.t),
      coveredTo: truncated ? lastT : to,
      truncated,
    };
  } finally {
    void rm(tmp, { recursive: true, force: true });
  }
}

export interface SilenceRange {
  start: number;
  end: number;
  duration: number;
}

/** Find silent stretches in a media file's audio (ffmpeg silencedetect).
 * Times are absolute source seconds. */
export async function detectSilence(
  projectId: string,
  sourceFile: string,
  opts: { from: number; to: number; thresholdDb: number; minSilence: number }
): Promise<SilenceRange[]> {
  const { from, to, thresholdDb, minSilence } = opts;
  const r = await runCapture(
    [
      "-hide_banner", "-nostats", "-loglevel", "info",
      ...(from > 0 ? ["-ss", num(from)] : []),
      "-t", num(to - from),
      "-i", mediaPath(projectId, sourceFile),
      "-vn", "-sn", "-dn",
      "-af", `silencedetect=n=${thresholdDb}dB:d=${num(minSilence)}`,
      "-f", "null", "-",
    ],
    60_000
  );
  if (!r.ok) {
    if (/does not contain any stream|matches no streams|Cannot find a matching stream/i.test(r.stderr))
      throw new Error("This file has no audio track.");
    throw new Error(
      r.timedOut ? "Silence detection timed out — try a shorter range." : errTail(r.stderr)
    );
  }
  const silences: SilenceRange[] = [];
  let open: number | null = null;
  for (const line of r.stderr.split("\n")) {
    const s = /silence_start: (-?[\d.]+)/.exec(line);
    if (s) {
      open = Math.max(from, from + parseFloat(s[1]));
      continue;
    }
    const e = /silence_end: (-?[\d.]+)/.exec(line);
    if (e && open !== null) {
      const end = Math.min(to, from + parseFloat(e[1]));
      if (end > open) silences.push({ start: round(open), end: round(end), duration: round(end - open) });
      open = null;
    }
  }
  // Silence still open at the end of the range closes there.
  if (open !== null && to > open)
    silences.push({ start: round(open), end: round(to), duration: round(to - open) });
  return silences;
}

/** Pull a media file's audio track off as a small mono AAC stream so the
 * assistant can hear it inline. Works for audio and video sources alike — the
 * video image never travels, and 32 kbps keeps ~50 min under the model's
 * inline cap. Times are absolute source seconds; an empty `to` runs to the end. */
export function extractAudio(
  projectId: string,
  sourceFile: string,
  opts: { from: number; to?: number },
): Promise<Buffer> {
  const { from, to } = opts;
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-hide_banner", "-nostats", "-loglevel", "error",
      ...(from > 0 ? ["-ss", num(from)] : []),
      ...(to !== undefined ? ["-t", num(to - from)] : []),
      "-i", mediaPath(projectId, sourceFile),
      "-vn", "-sn", "-dn",
      "-ac", "1", "-ar", "24000", "-c:a", "aac", "-b:a", "32k",
      "-f", "adts", "-",
    ]);
    const chunks: Buffer[] = [];
    let err = "";
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      reject(new Error("Reading the audio timed out — try a shorter from/to range."));
    }, 120_000);
    timer.unref();
    p.stdout.on("data", (d: Buffer) => chunks.push(d));
    p.stderr.on("data", (d) => (err = (err + d.toString()).slice(-4000)));
    p.on("error", (e) =>
      reject(
        e.message.includes("ENOENT")
          ? new Error("ffmpeg was not found. Install it with: brew install ffmpeg")
          : e,
      ),
    );
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) return resolve(Buffer.concat(chunks));
      if (/does not contain any stream|matches no streams|Cannot find a matching stream/i.test(err))
        return reject(new Error("This file has no audio track."));
      reject(new Error(errTail(err) || "Could not read the audio."));
    });
  });
}
