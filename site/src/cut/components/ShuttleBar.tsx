"use client";

import { useEffect, useRef, useState } from "react";
import { timelineScrollBy } from "@/cut/lib/timelineScroll";
import { useEditor } from "@/cut/lib/store";
import { cn } from "@/lib/utils";

/** How far the pointer has to travel from the press point to reach full
 * shuttle speed, in pixels. */
const SHUTTLE_RANGE = 90;

/** Press-and-drag jog control: distance from the press point sets a rate in
 * [-1, 1] (0 at the press point, ±1 at SHUTTLE_RANGE px out, clamped) and
 * direction. While held, `onTick` fires every animation frame with that rate
 * and the frame's elapsed seconds — the caller turns that into units/second
 * however it likes (playhead seconds, scroll pixels, a clip's start time...).
 * Releasing stops the loop and snaps the knob back to center; whatever the
 * caller was driving stays wherever it landed. `onStart`/`onRelease` bracket
 * the gesture, for callers that need a single undo checkpoint around it. */
export function ShuttleBar({
  onTick,
  onStart,
  onRelease,
}: {
  onTick: (rate: number, dt: number) => void;
  onStart?: () => void;
  onRelease?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [rate, setRate] = useState(0);
  // Mutable so the rAF loop and the pointermove listener read/write the same
  // live value without re-subscribing each render.
  const live = useRef({ rate: 0, lastTs: 0, raf: 0 });

  useEffect(() => () => cancelAnimationFrame(live.current.raf), []);

  const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    setDragging(true);
    onStart?.();
    live.current.lastTs = performance.now();

    const loop = (ts: number) => {
      const dt = (ts - live.current.lastTs) / 1000;
      live.current.lastTs = ts;
      if (live.current.rate !== 0) onTick(live.current.rate, dt);
      live.current.raf = requestAnimationFrame(loop);
    };
    live.current.raf = requestAnimationFrame(loop);

    const move = (ev: PointerEvent) => {
      const r = Math.max(-1, Math.min(1, (ev.clientX - startX) / SHUTTLE_RANGE));
      live.current.rate = r;
      setRate(r);
    };
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      cancelAnimationFrame(live.current.raf);
      live.current.rate = 0;
      setRate(0);
      setDragging(false);
      onRelease?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onPointerDown={startDrag}
        className={cn(
          "relative h-8 w-full max-w-56 cursor-ew-resize touch-none rounded-lg border bg-muted select-none",
          dragging ? "border-primary" : "border-border"
        )}
      >
        <div aria-hidden className="absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2 bg-border" />
        <div
          aria-hidden
          className={cn(
            "absolute top-1/2 size-6 -translate-y-1/2 rounded-full border bg-card shadow-sm transition-colors",
            dragging ? "border-primary" : "border-border"
          )}
          style={{ left: `calc(50% + ${rate * (SHUTTLE_RANGE / 2)}px - 12px)` }}
        />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {dragging ? `${rate >= 0 ? "" : "-"}${Math.abs(rate).toFixed(1)}x` : "Press and drag"}
      </span>
    </div>
  );
}

/** Shuttles the timeline's own horizontal scroll — panning the view without
 * touching the playhead or the project. Shared between the side panel and
 * the inline strip a narrow viewport shows under the preview instead. */
export function TimelineShuttleControl() {
  const MAX_PX_PER_SEC = 900;
  return <ShuttleBar onTick={(rate, dt) => timelineScrollBy(rate * MAX_PX_PER_SEC * dt)} />;
}

/** Shuttles the playhead itself, like a jog wheel — pauses playback first,
 * same as grabbing the ruler does. Shared the same way as the timeline one. */
export function PlayheadShuttleControl() {
  const MAX_SECONDS_PER_SEC = 12;
  const startShuttle = () => {
    const s = useEditor.getState();
    if (s.playing) s.setPlaying(false);
  };
  return (
    <div onPointerDownCapture={startShuttle}>
      <ShuttleBar
        onTick={(rate, dt) => {
          const s = useEditor.getState();
          s.seek(s.currentTime + rate * MAX_SECONDS_PER_SEC * dt);
        }}
      />
    </div>
  );
}
