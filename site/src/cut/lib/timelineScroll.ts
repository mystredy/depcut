"use client";

/** Timeline.tsx registers its scroll container here on mount; the right
 * rail's Timeline shuttle drives it from outside the component tree without
 * threading a ref through Editor's grid. Plain module state rather than a
 * store: the shuttle writes every animation frame while held, and routing
 * that through React state would re-render the whole tree for each one. */
let scrollEl: HTMLElement | null = null;

export function registerTimelineScroll(el: HTMLElement | null) {
  scrollEl = el;
}

/** No-op before Timeline has mounted or registered — the shuttle just does
 * nothing until there's a real scroll container to move. */
export function timelineScrollBy(dx: number) {
  if (!scrollEl) return;
  scrollEl.scrollLeft = Math.max(0, Math.min(scrollEl.scrollWidth - scrollEl.clientWidth, scrollEl.scrollLeft + dx));
}
