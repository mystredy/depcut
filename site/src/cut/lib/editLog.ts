// Turns a before/after doc snapshot into plain-English lines describing what
// changed. A drag, trim, or split made by hand in the timeline UI leaves no
// other trace, so this is how the AI agent learns what moves built the cut
// and when, not just the shape it's in now. Diffed off the same before/after
// pair the undo stack already captures at each commit (see push/flush in
// store.ts), so it costs nothing extra to compute and never misses an edit,
// whichever surface — a drag or an AI tool call — made it.

import type { AudioClip, MediaAsset, Overlay, TimelineTransition, VideoClip } from "./types";

interface Doc {
  clips: VideoClip[];
  transitions: TimelineTransition[];
  audioClips: AudioClip[];
  overlays: Overlay[];
  subtitles: { cues: unknown[] };
}

const r = (n: number) => Math.round(n * 100) / 100;
const trunc = (s: string) => (s.length > 30 ? `${s.slice(0, 30)}…` : s);

function assetName(assets: MediaAsset[], assetId: string): string {
  return assets.find((a) => a.id === assetId)?.name ?? "clip";
}

function byId<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((i) => [i.id, i]));
}

function diffClips(before: VideoClip[], after: VideoClip[], assets: MediaAsset[]): string[] {
  const lines: string[] = [];
  const beforeMap = byId(before);
  const afterMap = byId(after);
  for (const c of after) {
    if (!beforeMap.has(c.id))
      lines.push(`Added "${assetName(assets, c.assetId)}" to the timeline at ${r(c.start)}s (track ${c.track})`);
  }
  for (const c of before) {
    if (!afterMap.has(c.id)) lines.push(`Removed "${assetName(assets, c.assetId)}" from the timeline`);
  }
  for (const c of after) {
    const p = beforeMap.get(c.id);
    if (!p) continue;
    const changes: string[] = [];
    if (r(p.start) !== r(c.start) || p.track !== c.track) {
      changes.push(
        `moved ${r(p.start)}s→${r(c.start)}s${p.track !== c.track ? ` (track ${p.track}→${c.track})` : ""}`
      );
    }
    if (r(p.in) !== r(c.in) || r(p.out) !== r(c.out)) {
      changes.push(`trimmed in ${r(p.in)}→${r(c.in)}s, out ${r(p.out)}→${r(c.out)}s`);
    }
    if ((p.speed ?? 1) !== (c.speed ?? 1)) changes.push(`speed ${p.speed ?? 1}x→${c.speed ?? 1}x`);
    if (p.muted !== c.muted) changes.push(c.muted ? "muted" : "unmuted");
    if ((p.transition ?? 0) !== (c.transition ?? 0) || p.transitionStyle !== c.transitionStyle) {
      changes.push(
        (c.transition ?? 0) > 0
          ? `set ${c.transitionStyle ?? "crossfade"} transition into the next clip (${r(c.transition ?? 0)}s)`
          : "removed its transition into the next clip"
      );
    }
    if (p.look !== c.look || (p.lookAmount ?? 1) !== (c.lookAmount ?? 1)) {
      changes.push(c.look ? `applied the "${c.look}" look` : "removed its look");
    }
    if (changes.length > 0) lines.push(`Clip "${assetName(assets, c.assetId)}": ${changes.join("; ")}`);
  }
  return lines;
}

function diffAudio(before: AudioClip[], after: AudioClip[], assets: MediaAsset[]): string[] {
  const lines: string[] = [];
  const beforeMap = byId(before);
  const afterMap = byId(after);
  for (const c of after) {
    if (!beforeMap.has(c.id)) lines.push(`Added audio "${assetName(assets, c.assetId)}" at ${r(c.start)}s`);
  }
  for (const c of before) {
    if (!afterMap.has(c.id)) lines.push(`Removed audio "${assetName(assets, c.assetId)}"`);
  }
  for (const c of after) {
    const p = beforeMap.get(c.id);
    if (!p) continue;
    const changes: string[] = [];
    if (r(p.start) !== r(c.start)) changes.push(`moved ${r(p.start)}s→${r(c.start)}s`);
    if (r(p.in) !== r(c.in) || r(p.out) !== r(c.out))
      changes.push(`trimmed in ${r(p.in)}→${r(c.in)}s, out ${r(p.out)}→${r(c.out)}s`);
    if (r(p.volume) !== r(c.volume)) changes.push(`volume ${r(p.volume)}→${r(c.volume)}`);
    if (!!p.hidden !== !!c.hidden) changes.push(c.hidden ? "muted" : "unmuted");
    if (changes.length > 0) lines.push(`Audio "${assetName(assets, c.assetId)}": ${changes.join("; ")}`);
  }
  return lines;
}

/** The overlay's text when it's a title, else null — mirrors the same
 * shape/sticker/effect-exclusion aiContext.ts's describeOverlay uses, so this
 * narrows to TextOverlay the same way. */
function overlayText(o: Overlay): string | null {
  if (o.kind === "shape" || o.kind === "sticker" || o.kind === "effect") return null;
  return o.text;
}

function overlayLabel(o: Overlay): string {
  if (o.kind === "shape") return `${o.shape} shape`;
  if (o.kind === "sticker") return "sticker";
  if (o.kind === "effect") return `${o.effect} effect`;
  return `title "${trunc(o.text)}"`;
}

/** Same as overlayLabel but never quotes a title's own text — used to prefix
 * a CHANGE line, where a text edit already states the new text in the change
 * itself; quoting it again in the label read as "title \"X\": text changed
 * to \"X\"", the same string twice. */
function overlayKindLabel(o: Overlay): string {
  if (o.kind === "shape") return `${o.shape} shape`;
  if (o.kind === "sticker") return "sticker";
  if (o.kind === "effect") return `${o.effect} effect`;
  return "title";
}

function diffOverlays(before: Overlay[], after: Overlay[]): string[] {
  const lines: string[] = [];
  const beforeMap = byId(before);
  const afterMap = byId(after);
  for (const o of after) {
    if (!beforeMap.has(o.id)) lines.push(`Added ${overlayLabel(o)} at ${r(o.start)}s`);
  }
  for (const o of before) {
    if (!afterMap.has(o.id)) lines.push(`Removed ${overlayLabel(o)}`);
  }
  for (const o of after) {
    const p = beforeMap.get(o.id);
    if (!p) continue;
    const changes: string[] = [];
    if (r(p.start) !== r(o.start) || r(p.end) !== r(o.end)) {
      changes.push(`retimed ${r(p.start)}s–${r(p.end)}s → ${r(o.start)}s–${r(o.end)}s`);
    }
    const pText = overlayText(p);
    const oText = overlayText(o);
    if (pText !== null && oText !== null && pText !== oText) {
      changes.push(`text changed from "${trunc(pText)}" to "${trunc(oText)}"`);
    }
    if (changes.length > 0) lines.push(`${overlayKindLabel(o)}: ${changes.join("; ")}`);
  }
  return lines;
}

function diffTransitions(before: TimelineTransition[], after: TimelineTransition[]): string[] {
  const lines: string[] = [];
  const beforeMap = byId(before);
  const afterMap = byId(after);
  for (const t of after) {
    if (!beforeMap.has(t.id)) lines.push(`Added ${t.style} transition (${r(t.seconds)}s) at ${r(t.start)}s`);
  }
  for (const t of before) {
    if (!afterMap.has(t.id)) lines.push(`Removed the transition at ${r(t.start)}s`);
  }
  return lines;
}

/** One line per meaningful change between two doc snapshots — added, removed,
 * moved, or trimmed clips and audio, overlay edits, transitions, captions.
 * Appended to the project's edit log whenever a real edit commits. */
export function describeDocChange(before: Doc, after: Doc, assets: MediaAsset[]): string[] {
  const lines = [
    ...diffClips(before.clips, after.clips, assets),
    ...diffAudio(before.audioClips, after.audioClips, assets),
    ...diffOverlays(before.overlays, after.overlays),
    ...diffTransitions(before.transitions, after.transitions),
  ];
  if (JSON.stringify(before.subtitles.cues) !== JSON.stringify(after.subtitles.cues)) {
    lines.push("Edited captions");
  }
  return lines;
}
