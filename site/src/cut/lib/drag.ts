"use client";

import type React from "react";

interface DragOpts {
  onMove: (dx: number, dy: number, ev: PointerEvent) => void;
  onUp?: (dx: number, dy: number, moved: boolean) => void;
  /** Cursor to hold for the whole gesture, wherever the pointer travels. Read
   * again after every move, so a cursor that turns with what it is dragging
   * keeps up. */
  cursor?: () => string;
}

// Live count of in-flight pointer drags, so layout that depends on clip
// geometry (e.g. the timeline's scrollable width) can hold still until release.
let activeDrags = 0;
const dragListeners = new Set<() => void>();

export function subscribeDragActive(fn: () => void) {
  dragListeners.add(fn);
  return () => {
    dragListeners.delete(fn);
  };
}

export function isDragActive() {
  return activeDrags > 0;
}

/** Pointer-drag helper: tracks deltas from pointerdown until release.
 * Returns a `cancel` that tears the gesture down without firing `onUp` — for
 * a caller that needs to hand the same pointer off to something else (a
 * second finger turning a single-finger drag into a pinch, say). */
export function startDrag(e: React.PointerEvent, opts: DragOpts): () => void {
  e.preventDefault();
  e.stopPropagation();
  // preventDefault also suppresses the browser's default focus move, so end
  // any in-progress text edit here or keyboard shortcuts keep typing into it.
  if (document.activeElement !== e.currentTarget) {
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  // Scoped to the pointer that started the gesture: window-level listeners
  // otherwise fire for every active pointer, so a second finger touching
  // down anywhere else while this drag is live would otherwise feed its own
  // moves into the same delta math and jitter the result between the two.
  const pointerId = e.pointerId;
  const startX = e.clientX;
  const startY = e.clientY;
  let moved = false;
  activeDrags++;
  dragListeners.forEach((fn) => fn());

  // A drag pulls the pointer off the handle within a few pixels, and from there
  // the cursor belongs to whatever it happens to be over. One document-wide
  // rule outranks all of them until the gesture ends.
  const pin = opts.cursor ? document.createElement("style") : null;
  let pinned = "";
  const holdCursor = () => {
    if (!pin || !opts.cursor) return;
    const next = opts.cursor();
    if (next === pinned) return;
    pinned = next;
    pin.textContent = `*, *::before, *::after { cursor: ${next} !important; }`;
  };
  if (pin) {
    holdCursor();
    document.head.append(pin);
  }

  const cancel = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    pin?.remove();
    activeDrags--;
    dragListeners.forEach((fn) => fn());
  };

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    opts.onMove(dx, dy, ev);
    holdCursor();
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cancel();
    opts.onUp?.(ev.clientX - startX, ev.clientY - startY, moved);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);

  return cancel;
}
