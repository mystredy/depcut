"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { usePlayback } from "@/cut/hooks/usePlayback";
import { clearAssetDrag, setAssetDragData } from "@/cut/lib/assetDrag";
import { startDrag } from "@/cut/lib/drag";
import { getClipSpans, projectDuration, useEditor } from "@/cut/lib/store";
import {
  capturePoster,
  capturePosterWhenReady,
  paintPoster,
  readPoster,
} from "@/cut/lib/posterCache";
import { setPreviewCanvas } from "@/cut/lib/previewCanvas";
import { frameOf, isFullRect, rectOf, type Aspect, type ClipSpan, type FrameRect, type MediaAsset, type VideoClip } from "@/cut/lib/types";
import { cn } from "@/lib/utils";
import {
  ClipExtractStrip,
  ClipFramingSection,
  ClipMoveTimeSection,
  ClipMoveTrackStrip,
  ClipSpeedStrip,
  ClipTrimSection,
  ClipVolumeSection,
} from "./Inspector";
import { OverlayLayer } from "./OverlayLayer";
import { HANDLE_AXIS, TransformHandles, type ResizeHandle } from "./TransformHandles";
import { PlayheadShuttleControl, TimelineShuttleControl } from "./ShuttleBar";
import { StageEffectPaint, stageSlices, useEffectLanes, useStageEffects } from "./StageEffects";

/** Each Edit-rail clip tab with no room to dock on a narrow viewport: its
 * header label (shown above the content, next to the close button — the
 * docked column's own Row label doesn't apply here) and the content Preview
 * renders for it below. Trim, Move in time, Volume, and Framing already
 * carry their own top-of-content label(s) via Row ("Trim start"/"Trim end",
 * "Move in time", "Clip volume"/"Mute audio", "Framing"/"Layout" — same
 * width convention as a shuttle strip), so their section component doubles
 * as its own strip and the header goes label-less rather than repeat it;
 * Extract/Speed/Move track needed a compact, label-free variant split out
 * from their Row-wrapped desktop layout instead. */
const MOBILE_CLIP_TABS: Record<
  "extract" | "speed" | "move-track" | "trim" | "move-time" | "volume" | "framing",
  { label: string | null; Content: (props: { clip: VideoClip }) => ReactNode }
> = {
  extract: { label: "Extract audio", Content: ClipExtractStrip },
  speed: { label: "Speed", Content: ClipSpeedStrip },
  "move-track": { label: "Move track", Content: ClipMoveTrackStrip },
  trim: { label: null, Content: ClipTrimSection },
  "move-time": { label: null, Content: ClipMoveTimeSection },
  volume: { label: null, Content: ClipVolumeSection },
  framing: { label: null, Content: ClipFramingSection },
};

/** The clip under the playhead, when it overflows the frame in fill mode. */
function pannableSpan(s: {
  clips: VideoClip[];
  assets: MediaAsset[];
  currentTime: number;
  aspect: Aspect;
}): ClipSpan | null {
  const spans = getClipSpans(s.clips, s.assets);
  const span =
    spans.find((sp) => s.currentTime >= sp.start && sp.start + sp.len > s.currentTime) ??
    spans[spans.length - 1];
  // Pan only makes sense for a full-frame clip that actually overflows its
  // box — filling, or zoomed past what fitting/filling already needs. A
  // regioned clip is moved with its own preview handle instead.
  const clip = span?.clip;
  const zoom = clip?.zoom && clip.zoom > 1 ? clip.zoom : 1;
  if (!span || !clip || !(clip.fit === "fill" || zoom > 1) || !isFullRect(rectOf(clip))) return null;
  const { width, height } = span.asset;
  if (!width || !height) return null;
  const frame = frameOf(s.aspect);
  const scale = (clip.fit === "fill" ? Math.max(frame.w / width, frame.h / height) : Math.min(frame.w / width, frame.h / height)) * zoom;
  const ox = width * scale - frame.w;
  const oy = height * scale - frame.h;
  return ox > 1 || oy > 1 ? span : null;
}

/** Paint the picture this project's preview last showed, then hand the canvas
 * back to the engine. Cloud media is a network away, so without this the
 * preview holds black for about a second on every open while the first decoder
 * fetches and seeks — the engine leaves the canvas alone until it has a frame,
 * which is what lets a poster sit there in the meantime. Once a real frame
 * lands it is kept for the next open. */
function useCachedFirstFrame(canvasRef: RefObject<HTMLCanvasElement | null>) {
  // Re-runs per load, so reopening a project repaints and re-captures.
  const epoch = useEditor((s) => (s.loaded ? s.loadEpoch : 0));
  const projectId = useEditor((s) => s.projectId);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !epoch || !projectId) return;
    let alive = true;
    void readPoster("frame", projectId).then((data) => {
      // Only if the engine has not beaten us to it — a warm decoder paints
      // within the same frame, and the real picture outranks a stored one.
      if (alive && data && !capturePoster("frame", projectId, canvas)) {
        void paintPoster(canvas, data);
      }
    });
    const stop = capturePosterWhenReady("frame", projectId, () => canvasRef.current);
    return () => {
      alive = false;
      stop();
    };
  }, [canvasRef, epoch, projectId]);
}

export function Preview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 270, h: 480 });
  const pannable = useEditor((s) => pannableSpan(s) !== null);
  const aspect = useEditor((s) => s.aspect);
  const frame = frameOf(aspect);
  // Nothing on the timeline paints as a plain black frame (see usePlayback's
  // MISSING_FRAME fallback) — a hint keeps that from reading as broken,
  // since a freshly imported asset sits in the Media panel until dragged in.
  const timelineEmpty = useEditor(
    (s) => s.clips.length === 0 && s.overlays.length === 0 && s.audioClips.length === 0
  );
  const mobileShuttleTab = useEditor((s) => s.mobileShuttleTab);
  const mobileClipTab = useEditor((s) => s.mobileClipTab);
  const mobileClipTabClip = useEditor((s) =>
    s.mobileClipTab && s.selection?.kind === "clip"
      ? s.clips.find((c) => c.id === s.selection!.id)
      : undefined
  );
  const MobileClipTabContent = mobileClipTab ? MOBILE_CLIP_TABS[mobileClipTab].Content : null;

  usePlayback(canvasRef);
  // An effect grades what plays under it, so the stage is built in slices:
  // the picture, then the elements of each lane band with the look of the
  // effects above them, and each effect's paints sitting where the effect does.
  const stageFx = useStageEffects();
  const effectLanes = useEffectLanes();
  const { picture, slices } = stageSlices(stageFx, effectLanes);

  useEffect(() => {
    setPreviewCanvas(canvasRef.current);
    return () => setPreviewCanvas(null);
  }, []);

  useCachedFirstFrame(canvasRef);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const { w: rw, h: rh } = frameOf(aspect);
    const fit = () => {
      const r = wrap.getBoundingClientRect();
      const pad = 28;
      const availW = Math.max(120, r.width - pad);
      const availH = Math.max(120, r.height - pad);
      const scale = Math.min(availW / rw, availH / rh);
      setStage({ w: Math.floor(scale * rw), h: Math.floor(scale * rh) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [aspect]);

  const togglePlayback = () => {
    const s = useEditor.getState();
    const total = projectDuration(s);
    if (!total) return;
    if (!s.playing && s.currentTime >= total - 0.01) s.seek(0);
    s.setPlaying(!s.playing);
  };

  // Drag a fill-mode clip inside the frame to choose the visible crop.
  const panDrag = (e: React.PointerEvent) => {
    const s = useEditor.getState();
    const span = pannableSpan(s);
    if (!span) return false;
    const fr = frameOf(s.aspect);
    const { width = 1, height = 1 } = span.asset;
    const zoom = span.clip.zoom && span.clip.zoom > 1 ? span.clip.zoom : 1;
    const scale =
      (span.clip.fit === "fill" ? Math.max(fr.w / width, fr.h / height) : Math.min(fr.w / width, fr.h / height)) *
      zoom;
    const ox = width * scale - fr.w;
    const oy = height * scale - fr.h;
    const clipId = span.clip.id;
    const panX0 = span.clip.panX ?? 0;
    const panY0 = span.clip.panY ?? 0;
    const toFrame = fr.w / stage.w; // screen px → frame px
    // Selection moves to the panned clip only once the pointer actually travels;
    // a stationary press is a play/pause and leaves the selection alone.
    let began = false;
    startDrag(e, {
      onMove: (dx, dy) => {
        if (!began) {
          if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
          began = true;
          const st = useEditor.getState();
          st.select({ kind: "clip", id: clipId });
          st.pushHistory();
        }
        // Content follows the pointer; pan is the crop-window position.
        useEditor.getState().updateClipTransient(clipId, {
          panX: ox > 1 ? Math.max(-1, Math.min(1, panX0 - (dx * toFrame) / (ox / 2))) : 0,
          panY: oy > 1 ? Math.max(-1, Math.min(1, panY0 - (dy * toFrame) / (oy / 2))) : 0,
        });
      },
      // startDrag suppresses the click event, so a stationary press on a
      // pannable clip toggles playback here instead.
      onUp: (_dx, _dy, moved) => {
        if (!moved) togglePlayback();
      },
    });
    return true;
  };

  return (
    <section className="preview-pane flex min-h-0 min-w-0 flex-col bg-muted/40 select-none">
      <div
        ref={wrapRef}
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3"
        // The empty room around the picture is the only part of the preview that
        // clears the selection; the picture itself just plays and pauses.
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) useEditor.getState().select(null);
        }}
      >
        <div
          ref={stageRef}
          className={cn(
            "stage relative touch-none overflow-hidden rounded-xl bg-black shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_12px_36px_rgba(0,0,0,0.18)]",
            pannable && "cursor-grab active:cursor-grabbing"
          )}
          style={{ width: stage.w, height: stage.h }}
          onPointerDown={(e) => {
            if (
              e.target === e.currentTarget ||
              (e.target as HTMLElement).tagName === "CANVAS"
            ) {
              panDrag(e);
            }
          }}
          // A native drag on the canvas swallows the click, so this only fires
          // for a stationary click.
          onClick={(e) => {
            if (
              e.target === e.currentTarget ||
              (e.target as HTMLElement).tagName === "CANVAS"
            ) {
              togglePlayback();
            }
          }}
        >
          <canvas
            ref={canvasRef}
            width={frame.w}
            height={frame.h}
            className="block size-full"
            style={{ transform: picture.transform, filter: picture.filter }}
            // Drag the viewport to reference what's on screen: the clip under
            // the playhead travels as a media drag (timeline placement, chat
            // attachment, generation reference). Pan on a fill clip wins —
            // its pointerdown cancels the native drag.
            draggable
            onDragStart={(e) => {
              const s = useEditor.getState();
              const spans = getClipSpans(s.clips, s.assets);
              const t = s.currentTime;
              const span =
                spans.find((sp) => t >= sp.start && sp.start + sp.len > t) ??
                spans[spans.length - 1];
              if (!span) return e.preventDefault();
              setAssetDragData(e, span.asset.id);
            }}
            onDragEnd={clearAssetDrag}
          />
          {timelineEmpty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-sm text-white/60">Drag a clip from Media onto the timeline to preview it here</p>
            </div>
          )}
          {slices.map((slice) =>
            slice.kind === "elements" ? (
              <OverlayLayer
                key={slice.key}
                stageWidth={stage.w}
                transform={slice.transform}
                filter={slice.filter}
                from={slice.from}
                to={slice.to}
                captions={slice.captions}
              />
            ) : (
              <StageEffectPaint key={slice.key} states={slice.states} />
            )
          )}
        </div>
        {/* Rendered outside .stage, not inside it — the rotate handle sits
            above the box, and .stage's own overflow-hidden (there to clip
            the picture to its rounded corners) would cut it off whenever the
            selected clip's box sits flush against the stage's top edge. This
            sibling mirrors .stage's own centering so the two align exactly. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 p-3">
          <div className="relative" style={{ width: stage.w, height: stage.h }}>
            <OverlayPipHandle stage={stage} stageRef={stageRef} panDrag={panDrag} />
          </div>
        </div>
      </div>
      {/* A narrow viewport hands Timeline/Playhead's shuttle here instead of
          the side panel column, which would otherwise push this preview off
          to the side on a screen with no room to spare. */}
      {mobileShuttleTab && (
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border px-4 py-3">
          <div className="flex w-full max-w-56 items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {mobileShuttleTab === "timeline" ? "Pan the timeline" : "Shuttle the playhead"}
            </span>
            <button
              type="button"
              aria-label="Close"
              className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => useEditor.getState().setMobileShuttleTab(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          {mobileShuttleTab === "timeline" ? <TimelineShuttleControl /> : <PlayheadShuttleControl />}
        </div>
      )}
      {/* Same idea, for the Edit rail's clip tabs with no room to dock on a
          narrow viewport (Extract audio, Speed, Move track, Trim, Move in
          time, Volume, Framing): each hands its content here instead of the
          right rail column. */}
      {mobileClipTab && mobileClipTabClip && MobileClipTabContent && (
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-border px-4 py-3">
          <div className="flex w-full max-w-56 items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {MOBILE_CLIP_TABS[mobileClipTab].label}
            </span>
            <button
              type="button"
              aria-label="Close"
              className="grid size-5 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => useEditor.getState().setMobileClipTab(null)}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <MobileClipTabContent clip={mobileClipTabClip} />
        </div>
      )}
    </section>
  );
}

/** Rotate a screen-space drag delta by `-deg` — back into a rotated box's own
 * unrotated axes, so a grip still pulls the edge it visually sits on. */
function unturn(dx: number, dy: number, deg: number): { dx: number; dy: number } {
  if (!deg) return { dx, dy };
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos };
}

const ROTATE_SNAP = [-180, -90, 0, 90, 180];

/**
 * Direct-manipulation handle for the selected video layer's frame region: drag
 * the box to reposition, drag a grip to resize (both update the clip's
 * `frame` rect), drag the top handle to rotate it. Shows for any selected
 * clip on any track — a full-frame layer gets a handle flush with the stage
 * edges, so dragging a grip inward is how it becomes a regioned (split-screen
 * or PiP) clip in the first place — and only while that clip is live under
 * the playhead so it lines up with the compositor. Dragging the box itself
 * pans instead of repositioning whenever the clip is pannable (filling, or
 * zoomed past what fitting/filling needs) — reposition would be a no-op on a
 * full-frame box anyway, and pan is what a filled or zoomed clip needs.
 */
function OverlayPipHandle({
  stage,
  stageRef,
  panDrag,
}: {
  stage: { w: number; h: number };
  stageRef: RefObject<HTMLDivElement | null>;
  panDrag: (e: React.PointerEvent) => boolean;
}) {
  const selection = useEditor((s) => s.selection);
  const clips = useEditor((s) => s.clips);
  const currentTime = useEditor((s) => s.currentTime);
  const [turning, setTurning] = useState<number | null>(null);
  // Live positions of every pointer currently down on the box, and what the
  // gesture they're driving is — a single-finger move (with a cancel, so a
  // second finger can take over) or a two-finger pinch (baseline distance
  // and rect, to scale from as the fingers spread or close). Refs rather
  // than state: this updates every pointermove and never needs a render.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "drag"; cancel: () => void }
    | { kind: "pinch"; startDist: number; startRect: FrameRect }
    | null
  >(null);

  // Resolve the selected, live clip (any track) plus how to patch its rect. A
  // clip's own footprint equals its span length, so one path serves every
  // track.
  let rect: FrameRect | null = null;
  let apply: ((frame: FrameRect) => void) | null = null;
  let applyRotation: ((deg: number | undefined) => void) | null = null;
  let rotation = 0;
  if (selection?.kind === "clip") {
    const clip = clips.find((c) => c.id === selection.id);
    if (clip && !clip.hidden) {
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
      const len = Math.max(0.1, (clip.out - clip.in) / speed);
      if (currentTime >= clip.start && currentTime < clip.start + len) {
        rect = rectOf(clip);
        rotation = clip.rotation ?? 0;
        apply = (frame) => useEditor.getState().updateClipTransient(clip.id, { frame });
        applyRotation = (deg) => useEditor.getState().updateClipTransient(clip.id, { rotation: deg });
      }
    }
  }
  if (!rect || !apply || !applyRotation) return null;
  const r = rect;
  const patch = apply;
  const setRotation = applyRotation;

  // A second finger landing on the box while the first is already dragging it
  // hands off to a pinch — cancels the single-finger drag and scales the box
  // from its own center instead of two drags fighting over the same rect.
  const onBoxPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      // A pannable clip (filling, or zoomed) drags its crop window instead —
      // repositioning the frame rect would be a no-op on a full-frame box,
      // and panDrag already checks pannability itself (fit/zoom, overflow).
      // It owns that pointer's whole gesture, pinch handoff included — this
      // box doesn't get a rect to pinch until it's an actual regioned clip.
      if (panDrag(e)) return;
      e.stopPropagation();
      useEditor.getState().pushHistory();
      const cancel = startDrag(e, {
        // Free to drag anywhere from fully on-frame to fully off past either
        // edge — not clamped to stay inside the visible frame, since parking
        // a clip off to one side (ready to slide in, say) is a real use.
        onMove: (dx, dy) =>
          patch({
            ...r,
            x: Math.max(-r.w, Math.min(1, r.x + dx / stage.w)),
            y: Math.max(-r.h, Math.min(1, r.y + dy / stage.h)),
          }),
        onUp: () => {
          gesture.current = null;
        },
      });
      gesture.current = { kind: "drag", cancel };
      return;
    }

    if (pointers.current.size === 2) {
      e.stopPropagation();
      // The single-finger drag already pushed history for this gesture; only
      // push again if a pinch starts fresh (e.g. both fingers land at once).
      if (gesture.current?.kind === "drag") gesture.current.cancel();
      else useEditor.getState().pushHistory();
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", startDist: Math.hypot(a.x - b.x, a.y - b.y), startRect: r };
    }
  };

  const onBoxPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gesture.current?.kind !== "pinch" || pointers.current.size < 2) return;
    const [a, b] = [...pointers.current.values()];
    const scale = Math.hypot(a.x - b.x, a.y - b.y) / gesture.current.startDist;
    const sr = gesture.current.startRect;
    const w = Math.max(0.05, sr.w * scale);
    const h = Math.max(0.05, sr.h * scale);
    patch({ x: sr.x - (w - sr.w) / 2, y: sr.y - (h - sr.h) / 2, w, h });
  };

  const onBoxPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (gesture.current?.kind === "pinch" && pointers.current.size < 2) {
      gesture.current = null;
    }
  };

  // A grip drags its own edge and leaves the opposite one planted: the box
  // keeps its far corner where it is while the grabbed side travels. The drag
  // delta is un-rotated back into the box's own axes first, so a grip on a
  // turned box still pulls the edge it visually sits on.
  const onResize = (handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    useEditor.getState().pushHistory();
    const a = HANDLE_AXIS[handle];
    // Free to grow past the frame edge, same as dragging the whole box past
    // it — only a floor on how small it can shrink to, no ceiling on how
    // large it can grow.
    const pull = (dir: -1 | 0 | 1, pos: number, size: number, delta: number) => {
      if (!dir) return { pos, size };
      if (dir > 0) return { pos, size: Math.max(0.1, size + delta) };
      const far = pos + size;
      const next = Math.max(0.1, size - delta);
      return { pos: far - next, size: next };
    };
    startDrag(e, {
      onMove: (dx, dy) => {
        const u = unturn(dx, dy, rotation);
        const hx = pull(a.x, r.x, r.w, u.dx / stage.w);
        const hy = pull(a.y, r.y, r.h, u.dy / stage.h);
        patch({ ...r, x: hx.pos, w: hx.size, y: hy.pos, h: hy.size });
      },
    });
  };

  // The pointer's polar angle around the box's own (screen-space) center, at
  // grab time vs. during the drag — the difference is added onto the clip's
  // existing rotation, wrapped to ±180° and snapped to the cardinal angles
  // within a few degrees.
  const onRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    useEditor.getState().pushHistory();
    const stageEl = stageRef.current;
    if (!stageEl) return;
    const stageBox = stageEl.getBoundingClientRect();
    const cx = stageBox.left + (r.x + r.w / 2) * stage.w;
    const cy = stageBox.top + (r.y + r.h / 2) * stage.h;
    const angleAt = (x: number, y: number) => (Math.atan2(y - cy, x - cx) * 180) / Math.PI + 90;
    const grabX = e.clientX;
    const grabY = e.clientY;
    const from = angleAt(grabX, grabY);
    setTurning(rotation);
    startDrag(e, {
      onMove: (dx, dy) => {
        const raw = rotation + (angleAt(grabX + dx, grabY + dy) - from);
        const wrapped = ((((raw + 180) % 360) + 360) % 360) - 180;
        const snapped = ROTATE_SNAP.find((t) => Math.abs(wrapped - t) < 4);
        const deg = Math.round(snapped ?? wrapped);
        setTurning(deg);
        setRotation(deg === 0 ? undefined : deg);
      },
      onUp: () => setTurning(null),
    });
  };

  return (
    <div
      className="absolute rounded-[3px]"
      style={{ left: r.x * stage.w, top: r.y * stage.h, width: r.w * stage.w, height: r.h * stage.h }}
    >
      <div
        className="pointer-events-auto absolute inset-0 touch-none cursor-move rounded-[3px] border-2 border-dashed border-[#0a84ff]"
        style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        onPointerDown={onBoxPointerDown}
        onPointerMove={onBoxPointerMove}
        onPointerUp={onBoxPointerUp}
        onPointerCancel={onBoxPointerUp}
      >
        <TransformHandles
          color="#0a84ff"
          handles={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
          rotation={rotation}
          angle={turning}
          onResize={onResize}
          onRotate={onRotate}
        />
      </div>
    </div>
  );
}
