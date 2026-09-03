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
  // Pan only makes sense for a full-frame fill clip; a regioned clip is moved
  // with its own preview handle instead.
  if (!span || span.clip.fit !== "fill" || !isFullRect(rectOf(span.clip))) return null;
  const { width, height } = span.asset;
  if (!width || !height) return null;
  const frame = frameOf(s.aspect);
  const scale = Math.max(frame.w / width, frame.h / height);
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
    const scale = Math.max(fr.w / width, fr.h / height);
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
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-3"
        // The empty room around the picture is the only part of the preview that
        // clears the selection; the picture itself just plays and pauses.
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) useEditor.getState().select(null);
        }}
      >
        <div
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
          <OverlayPipHandle stage={stage} />
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

/**
 * Direct-manipulation handle for the selected video layer's frame region: drag
 * the box to reposition, drag the corner to resize (both update the clip's
 * `frame` rect). Works for a regioned track-0 clip (split-screen half) or an
 * overlay clip, and only while that clip is live under the playhead so it lines
 * up with the compositor. A full-frame layer needs no handle.
 */
function OverlayPipHandle({ stage }: { stage: { w: number; h: number } }) {
  const selection = useEditor((s) => s.selection);
  const clips = useEditor((s) => s.clips);
  const currentTime = useEditor((s) => s.currentTime);

  // Resolve the selected, live, regioned clip (any track) plus how to patch its
  // rect. A clip's own footprint equals its span length, so one path serves
  // every track.
  let rect: FrameRect | null = null;
  let apply: ((frame: FrameRect) => void) | null = null;
  if (selection?.kind === "clip") {
    const clip = clips.find((c) => c.id === selection.id);
    if (clip && !clip.hidden) {
      const speed = clip.speed && clip.speed > 0 ? clip.speed : 1;
      const len = Math.max(0.1, (clip.out - clip.in) / speed);
      if (currentTime >= clip.start && currentTime < clip.start + len) {
        rect = rectOf(clip);
        apply = (frame) => useEditor.getState().updateClipTransient(clip.id, { frame });
      }
    }
  }
  if (!rect || !apply || isFullRect(rect)) return null;
  const r = rect;
  const patch = apply;

  const onMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    useEditor.getState().pushHistory();
    startDrag(e, {
      onMove: (dx, dy) =>
        patch({
          ...r,
          x: Math.max(0, Math.min(1 - r.w, r.x + dx / stage.w)),
          y: Math.max(0, Math.min(1 - r.h, r.y + dy / stage.h)),
        }),
    });
  };

  const onResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    useEditor.getState().pushHistory();
    startDrag(e, {
      onMove: (dx, dy) =>
        patch({
          ...r,
          w: Math.max(0.1, Math.min(1 - r.x, r.w + dx / stage.w)),
          h: Math.max(0.1, Math.min(1 - r.y, r.h + dy / stage.h)),
        }),
    });
  };

  return (
    <div
      className="absolute touch-none cursor-move rounded-[3px] shadow-[inset_0_0_0_2px_#a855f7]"
      style={{ left: r.x * stage.w, top: r.y * stage.h, width: r.w * stage.w, height: r.h * stage.h }}
      onPointerDown={onMove}
    >
      <span
        className="absolute -right-1.5 -bottom-1.5 size-3 touch-none cursor-nwse-resize rounded-full bg-violet-500 shadow-[0_0_0_2px_white]"
        onPointerDown={onResize}
      />
    </div>
  );
}
