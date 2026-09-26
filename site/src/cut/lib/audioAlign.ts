/**
 * Aligning two recordings of the same performance by pitch content.
 *
 * A cover and the source track it follows differ in instrumentation, mix,
 * and often tempo — matching raw waveforms or loudness doesn't survive any
 * of that. Chroma (how much energy each of the 12 pitch classes carries,
 * octaves folded together) mostly does: two performances of the same melody
 * land close in chroma even on different instruments. Dynamic time warping
 * then finds the best-cost path between the two chroma sequences even when
 * one runs faster or slower than the other, or starts with an intro the
 * other doesn't have.
 *
 * Pure array math — no DOM or Node APIs — so both the browser (cloud mode)
 * and the local engine can extract PCM their own way and hand it here.
 */

export interface AlignPoint {
  /** Seconds into the reference source. */
  referenceTime: number;
  /** The matching seconds into the compared source. */
  comparedTime: number;
  /** 0..1 — how well the two frames' pitch content agrees at this point. */
  confidence: number;
}

export interface AlignResult {
  points: AlignPoint[];
  /** 0..1 overall — the warping path's average local confidence. */
  confidence: number;
}

/** Longest span either source analyzes in one call. A typical pop song fits
 * well under this; a longer file should be scoped with from/to. */
export const ALIGN_MAX_SECONDS = 240;

/** The analysis sample rate PCM should be resampled to before aligning —
 * plenty for chroma up to a few kHz, and cheap to run DTW over. */
export const ALIGN_SAMPLE_RATE = 8000;

const HOP_SECONDS = 0.2;
const WINDOW_SECONDS = 0.4;
const MIN_MIDI = 36; // C2 — below this is mostly rhythm section, not melody
const MAX_MIDI = 84; // C6

function noteFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Single-bin DFT magnitude of `frame` at `freq` (Goertzel) — cheaper than a
 * full FFT when only a fixed handful of target frequencies matter. */
function goertzelMagnitude(frame: Float32Array, sampleRate: number, freq: number): number {
  const n = frame.length;
  const k = Math.round((n * freq) / sampleRate);
  const omega = (2 * Math.PI * k) / n;
  const coeff = 2 * Math.cos(omega);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    const s0 = frame[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  const real = s1 - s2 * Math.cos(omega);
  const imag = s2 * Math.sin(omega);
  return Math.sqrt(real * real + imag * imag) / n;
}

/** One 12-bin chroma vector (pitch-class energy, octaves folded, L2-
 * normalized) per hop across `pcm` (mono, `sampleRate`). */
function chromaFrames(pcm: Float32Array, sampleRate: number): Float32Array[] {
  const hop = Math.max(1, Math.round(HOP_SECONDS * sampleRate));
  const win = Math.max(hop, Math.round(WINDOW_SECONDS * sampleRate));
  const notes: { pitchClass: number; freq: number }[] = [];
  for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
    const freq = noteFreq(midi);
    if (freq < sampleRate / 2) notes.push({ pitchClass: midi % 12, freq });
  }

  const frames: Float32Array[] = [];
  for (let start = 0; start + win <= pcm.length; start += hop) {
    const frame = pcm.subarray(start, start + win);
    const chroma = new Float32Array(12);
    for (const { pitchClass, freq } of notes) chroma[pitchClass] += goertzelMagnitude(frame, sampleRate, freq);
    let norm = 0;
    for (let i = 0; i < 12; i++) norm += chroma[i] * chroma[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < 12; i++) chroma[i] /= norm;
    frames.push(chroma);
  }
  return frames;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  for (let i = 0; i < 12; i++) dot += a[i] * b[i];
  return 1 - Math.max(-1, Math.min(1, dot));
}

/** Best-cost warping path between two chroma sequences (Sakoe-Chiba banded
 * DTW): cell (i,j) costs the frames' own distance plus the cheapest way to
 * have reached it from (i-1,j-1), (i-1,j), or (i,j-1). Banding keeps this
 * O(n·band) instead of O(n·m) and rules out degenerate all-one-way paths. */
function dtwPath(a: Float32Array[], b: Float32Array[]): { path: [number, number][]; avgCost: number } {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return { path: [], avgCost: 1 };
  const band = Math.max(50, Math.round(0.25 * Math.max(n, m)));
  const INF = Infinity;
  const cost = new Float32Array(n * m).fill(INF);
  const back = new Uint8Array(n * m); // 0 = diag, 1 = a advances, 2 = b advances
  const at = (i: number, j: number) => i * m + j;

  for (let i = 0; i < n; i++) {
    const jLo = Math.max(0, i - band);
    const jHi = Math.min(m - 1, i + band);
    for (let j = jLo; j <= jHi; j++) {
      const d = cosineDistance(a[i], b[j]);
      if (i === 0 && j === 0) {
        cost[at(i, j)] = d;
        continue;
      }
      let best = INF;
      let dir = 0;
      if (i > 0 && j > 0 && cost[at(i - 1, j - 1)] < best) { best = cost[at(i - 1, j - 1)]; dir = 0; }
      if (i > 0 && cost[at(i - 1, j)] < best) { best = cost[at(i - 1, j)]; dir = 1; }
      if (j > 0 && cost[at(i, j - 1)] < best) { best = cost[at(i, j - 1)]; dir = 2; }
      if (best === INF) continue;
      cost[at(i, j)] = d + best;
      back[at(i, j)] = dir;
    }
  }

  // Backtrack from the cheapest reachable cell on the last row of `a` — the
  // path need not run to `b`'s end, since the compared source can run long.
  let endJ = -1;
  let bestEnd = INF;
  const jLo = Math.max(0, n - 1 - band);
  const jHi = Math.min(m - 1, n - 1 + band);
  for (let j = jLo; j <= jHi; j++) {
    if (cost[at(n - 1, j)] < bestEnd) { bestEnd = cost[at(n - 1, j)]; endJ = j; }
  }
  if (endJ < 0) return { path: [], avgCost: 1 };

  const path: [number, number][] = [];
  let i = n - 1;
  let j = endJ;
  for (;;) {
    path.push([i, j]);
    if (i === 0 && j === 0) break;
    const dir = back[at(i, j)];
    if (dir === 0) { i--; j--; }
    else if (dir === 1) { i--; }
    else { j--; }
    if (i < 0 || j < 0) break;
  }
  path.reverse();
  return { path, avgCost: bestEnd / Math.max(1, path.length) };
}

/** Align `comparedPcm` onto `referencePcm` (both mono, same `sampleRate`):
 * chroma both sources, run banded DTW, then resample the warping path to one
 * match point roughly every `stepSeconds` of the reference. */
export function alignAudio(
  referencePcm: Float32Array,
  comparedPcm: Float32Array,
  sampleRate: number,
  stepSeconds = 1
): AlignResult {
  const a = chromaFrames(referencePcm, sampleRate);
  const b = chromaFrames(comparedPcm, sampleRate);
  const { path, avgCost } = dtwPath(a, b);
  if (path.length === 0) return { points: [], confidence: 0 };

  const stepFrames = Math.max(1, Math.round(stepSeconds / HOP_SECONDS));
  const points: AlignPoint[] = [];
  let lastI = -stepFrames;
  for (const [i, j] of path) {
    if (i - lastI < stepFrames) continue;
    lastI = i;
    points.push({
      referenceTime: Math.round(i * HOP_SECONDS * 100) / 100,
      comparedTime: Math.round(j * HOP_SECONDS * 100) / 100,
      confidence: Math.round(Math.max(0, 1 - cosineDistance(a[i], b[j])) * 100) / 100,
    });
  }
  // The path's true endpoint carries the furthest-reaching match — keep it
  // even when it falls inside the last step.
  const [li, lj] = path[path.length - 1];
  const last = points[points.length - 1];
  if (!last || li * HOP_SECONDS - last.referenceTime > 0.01) {
    points.push({
      referenceTime: Math.round(li * HOP_SECONDS * 100) / 100,
      comparedTime: Math.round(lj * HOP_SECONDS * 100) / 100,
      confidence: Math.round(Math.max(0, 1 - cosineDistance(a[li], b[lj])) * 100) / 100,
    });
  }
  return { points, confidence: Math.round(Math.max(0, 1 - avgCost) * 100) / 100 };
}
