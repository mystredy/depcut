"use client";

import { useState } from "react";
import { Layers, Ratio, SlidersHorizontal, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MEDIA_CORS } from "@/cut/lib/mediaCors";
import { useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { formatTime } from "@/cut/lib/time";
import type { MediaAsset } from "@/cut/lib/types";
import { cn } from "@/lib/utils";
import { AspectRatioControl } from "./AspectRatioControl";
import { Inspector } from "./Inspector";

type RightTab = "edit" | "overlay" | "aspect";

const TABS: { id: RightTab; label: string; icon: typeof Layers }[] = [
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "overlay", label: "Overlay", icon: Layers },
  { id: "aspect", label: "Aspect ratio", icon: Ratio },
];

/** The right rail: mirrors the left SidePanel's icon+label tabs. Edit holds
 * the selection inspector (the whole of the old Inspector column); Overlay
 * adds a project asset onto a layer above the main track; Aspect ratio
 * exposes the same project-aspect control as the top bar. */
export function RightPanel() {
  const hasEditContent = useEditor(
    (s) => s.selection != null && s.selection.kind !== "cue" && s.selection.kind !== "transition"
  );
  const [tab, setTab] = useLocalPref<RightTab | null>("cut-right-tab", "edit", (v) =>
    v === null || TABS.some((t) => t.id === v)
  );

  // A new selection with its own panel jumps here automatically, the way the
  // old always-on Inspector column used to just appear.
  const selectionKey = useEditor((s) =>
    s.selection ? `${s.selection.kind}:${s.selection.id}` : null
  );
  const [seenKey, setSeenKey] = useState(selectionKey);
  if (selectionKey !== seenKey) {
    setSeenKey(selectionKey);
    if (selectionKey && hasEditContent) setTab("edit");
  }

  return (
    <div className="flex min-h-0 border-l border-border bg-card">
      {tab !== null && (
        <div
          className={cn(
            "flex min-h-0 shrink-0 flex-col",
            // Below sm there's no room to squeeze a 264px column out of the
            // canvas, so Aspect ratio floats instead: a card pinned to the
            // bottom-right corner of the viewport, on top of the timeline,
            // rather than pushing Preview sideways. Edit and Overlay still
            // dock inline on every width — only asked to move this one.
            tab === "aspect"
              ? "fixed right-3 bottom-3 z-[60] max-h-[70vh] w-64 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:static sm:z-auto sm:max-h-none sm:w-[264px] sm:max-w-none sm:overflow-visible sm:rounded-none sm:border-0 sm:border-r sm:shadow-none"
              : "w-[264px] border-r border-border"
          )}
        >
          {tab === "edit" ? (
            <>
              {/* Inspector's own sub-panel headers (ClipHead, PanelTitle, ...)
                  run flush to the edge with no room reserved for an overlay
                  button, so the close button gets its own row here instead of
                  floating on top of them like it does on the other two tabs. */}
              <div className="flex h-9 shrink-0 items-center pl-2.5">
                <ClosePanelButton onClose={() => setTab(null)} inline />
              </div>
              {/* A grid cell (rather than another flex child) stretches
                  Inspector to the full remaining height regardless of its own
                  root's classes — the same stretch it got for free as
                  Editor's direct grid item. */}
              <div className="grid min-h-0 flex-1">
                {hasEditContent ? (
                  <Inspector />
                ) : (
                  <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                    Select a clip, overlay, or audio clip to edit it here.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="relative flex min-h-0 flex-1 flex-col">
              <ClosePanelButton onClose={() => setTab(null)} />
              {tab === "overlay" ? <OverlayPanel /> : <AspectPanel />}
            </div>
          )}
        </div>
      )}
      <ScrollArea
        className="min-h-0 w-12 shrink-0 sm:w-[68px]"
        contentClassName="flex flex-col items-center gap-0.5 py-2 sm:gap-1 sm:py-3"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="flex w-full min-w-0 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground sm:py-1.5"
            aria-label={label}
            aria-pressed={tab === id}
            onClick={() => setTab(tab === id ? null : id)}
          >
            <span
              className={cn(
                "grid size-9 place-items-center rounded-lg transition-colors",
                tab === id ? "bg-foreground/10 text-foreground" : "hover:bg-muted/60"
              )}
            >
              <Icon className="size-4.5" />
            </span>
            <span
              className={cn(
                "hidden w-full truncate text-center text-[10px] font-medium tracking-tight sm:block",
                tab === id && "text-foreground"
              )}
            >
              {label}
            </span>
          </button>
        ))}
      </ScrollArea>
    </div>
  );
}

/** `inline` sits in normal flow (the Edit tab's own close row); otherwise it
 * floats over the top-left corner of a PanelHead. */
function ClosePanelButton({ onClose, inline }: { onClose: () => void; inline?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Close panel"
      title="Close panel"
      className={cn(
        "z-10 grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        inline ? "bg-transparent" : "absolute top-2.5 left-2.5 bg-card"
      )}
      onClick={onClose}
    >
      <X className="size-4" />
    </button>
  );
}

/** Left-padded to clear ClosePanelButton, which floats over this row. */
function PanelHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex h-12 shrink-0 flex-col justify-center gap-0.5 pr-2.5 pl-11">
      <span className="text-sm font-semibold tracking-tight">{title}</span>
      {hint && <span className="truncate text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Pick a project video or photo to composite above the main track — the
 * clip lands on layer 1, packed after whatever else already sits there. */
function OverlayPanel() {
  const assets = useEditor((s) => s.assets).filter(
    (a) => a.origin == null && (a.type === "video" || a.type === "image")
  );

  const add = (asset: MediaAsset) => {
    const s = useEditor.getState();
    s.addVideoFromAsset(asset.id, { kind: "track", track: 1 }, s.currentTime);
  };

  return (
    <>
      <PanelHead title="Overlay" hint="Adds above the main track, not into it" />
      <ScrollArea className="min-h-0 flex-1" contentClassName="grid grid-cols-2 gap-1.5 px-3.5 pb-4">
        {assets.length === 0 ? (
          <p className="col-span-2 px-1 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
            No video or photo assets yet — add some from Media first.
          </p>
        ) : (
          assets.map((a) => (
            <button
              key={a.id}
              type="button"
              title={a.name}
              onClick={() => add(a)}
              className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted text-left transition-colors hover:border-input"
            >
              {a.type === "video" ? (
                <video
                  crossOrigin={MEDIA_CORS}
                  src={`${a.url}#t=0.1`}
                  preload="metadata"
                  muted
                  playsInline
                  className="size-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- engine/static file, not Next-optimizable
                <img crossOrigin={MEDIA_CORS} src={a.url} alt={a.name} loading="lazy" className="size-full object-cover" />
              )}
              {a.type === "video" && (
                <span className="absolute right-1 bottom-1 rounded-[5px] bg-black/65 px-1 py-px font-mono text-[9.5px] text-white tabular-nums">
                  {formatTime(a.duration)}
                </span>
              )}
            </button>
          ))
        )}
      </ScrollArea>
    </>
  );
}

function AspectPanel() {
  return (
    <>
      <PanelHead title="Aspect ratio" hint="Sets the project's frame shape" />
      <ScrollArea className="min-h-0 flex-1" contentClassName="px-2.5 pb-4">
        <AspectRatioControl variant="list" />
      </ScrollArea>
    </>
  );
}
