"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Crosshair, Layers, Loader2, MoveHorizontal, Ratio, SlidersHorizontal, X } from "lucide-react";
import {
  Drawer,
  DrawerBackdrop,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
  DrawerViewport,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { importFileToProject } from "@/cut/lib/media";
import { useEditor } from "@/cut/lib/store";
import { timelineScrollBy } from "@/cut/lib/timelineScroll";
import { useLocalPref } from "@/cut/lib/uiState";
import { cn } from "@/lib/utils";
import {
  AspectCustomFields,
  AspectPresetList,
  AspectRatioControl,
  useAspectRatioPicker,
} from "./AspectRatioControl";
import { Inspector } from "./Inspector";

/** Below `sm` there's no room to dock a 264px column without swallowing the
 * canvas, so on a narrow viewport Aspect ratio opens as a bottom sheet
 * instead. A wrong guess on the first paint only picks which of two open
 * gestures a tap performs — unlike useIsNarrow (which gates what mounts —
 * see its own doc comment), that's cheap enough to guess eagerly rather than
 * wait out the media query. */
function useNarrowRail(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === "undefined" ? false : !window.matchMedia("(min-width: 640px)").matches
  );
  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const sync = () => setNarrow(!query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return narrow;
}

type RightTab = "edit" | "aspect" | "timeline" | "playhead";
/** Every rail icon, including the one ("overlay") that isn't a panel tab at
 * all — it fires an action directly instead of toggling one open. */
type RailId = RightTab | "overlay";

const TABS: { id: RailId; label: string; icon: typeof Layers }[] = [
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "overlay", label: "Overlay", icon: Layers },
  { id: "aspect", label: "Aspect ratio", icon: Ratio },
  { id: "timeline", label: "Timeline", icon: MoveHorizontal },
  { id: "playhead", label: "Playhead", icon: Crosshair },
];

/** The right rail: mirrors the left SidePanel's icon+label tabs. Edit holds
 * the selection inspector (the whole of the old Inspector column); Aspect
 * ratio exposes the same project-aspect control as the top bar. Overlay
 * isn't a panel — tapping it goes straight to a file picker and adds the
 * result to the overlay track, the same as the Media card's own "Add
 * overlay" action, rather than opening a picker panel first. */
export function RightPanel() {
  const narrow = useNarrowRail();
  const hasEditContent = useEditor(
    (s) => s.selection != null && s.selection.kind !== "cue" && s.selection.kind !== "transition"
  );
  const [tab, setTab] = useLocalPref<RightTab | null>("cut-right-tab", "edit", (v) =>
    v === null || (["edit", "aspect", "timeline", "playhead"] as RightTab[]).includes(v as RightTab)
  );

  // A new selection with its own panel jumps here automatically, the way the
  // old always-on Inspector column used to just appear — including the
  // clip Overlay's import just added.
  const selectionKey = useEditor((s) =>
    s.selection ? `${s.selection.kind}:${s.selection.id}` : null
  );
  const [seenKey, setSeenKey] = useState(selectionKey);
  if (selectionKey !== seenKey) {
    setSeenKey(selectionKey);
    if (selectionKey && hasEditContent) setTab("edit");
  }

  const overlayInputRef = useRef<HTMLInputElement>(null);
  const [overlayImporting, setOverlayImporting] = useState(0);
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const importOverlayFiles = async (files: FileList) => {
    const projectId = useEditor.getState().projectId;
    if (!projectId) return;
    setOverlayError(null);
    // One at a time: addOverlayFromAsset packs each new clip against
    // whatever the overlay tracks already hold, so a batch has to land in
    // order rather than racing on the same "where's the next gap" read.
    for (const file of Array.from(files)) {
      setOverlayImporting((n) => n + 1);
      try {
        const asset = await importFileToProject(projectId, file);
        if (!asset || (asset.type !== "video" && asset.type !== "image")) {
          setOverlayError(`${file.name} isn't a video or photo.`);
          continue;
        }
        useEditor.getState().addAsset(asset);
        useEditor.getState().addOverlayFromAsset(asset.id);
      } catch {
        setOverlayError(`Couldn't import ${file.name}.`);
      } finally {
        setOverlayImporting((n) => n - 1);
      }
    }
  };

  // On a narrow viewport, Aspect ratio's content moves into the bottom sheet
  // below instead of docking inline — Edit still docks at every width, so
  // only that one tab skips the column here.
  const aspectDocksInline = !(narrow && tab === "aspect");

  return (
    <div className="flex min-h-0 border-l border-border bg-card">
      {tab !== null && aspectDocksInline && (
        <div className="flex w-[264px] min-h-0 shrink-0 flex-col border-r border-border">
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
              {tab === "aspect" ? (
                <AspectPanel />
              ) : tab === "timeline" ? (
                <TimelineShuttlePanel />
              ) : (
                <PlayheadShuttlePanel />
              )}
            </div>
          )}
        </div>
      )}
      <ScrollArea
        className="min-h-0 w-12 shrink-0 sm:w-[68px]"
        contentClassName="flex flex-col items-center gap-0.5 py-2 sm:gap-1 sm:py-3"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const isOverlay = id === "overlay";
          const active = !isOverlay && tab === id;
          return (
            <button
              key={id}
              className="flex w-full min-w-0 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground sm:py-1.5"
              aria-label={label}
              aria-pressed={active}
              title={isOverlay && overlayError ? overlayError : undefined}
              onClick={() =>
                isOverlay ? overlayInputRef.current?.click() : setTab(tab === id ? null : (id as RightTab))
              }
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-lg transition-colors",
                  active ? "bg-foreground/10 text-foreground" : "hover:bg-muted/60"
                )}
              >
                {isOverlay && overlayImporting > 0 ? (
                  <Loader2 className="size-4.5 animate-spin" />
                ) : (
                  <Icon className="size-4.5" />
                )}
              </span>
              <span
                className={cn(
                  "hidden w-full truncate text-center text-[10px] font-medium tracking-tight sm:block",
                  active && "text-foreground"
                )}
              >
                {label}
              </span>
            </button>
          );
        })}
      </ScrollArea>
      {narrow && (
        <AspectDrawer open={tab === "aspect"} onOpenChange={(o) => setTab(o ? "aspect" : null)} />
      )}
      <input
        ref={overlayInputRef}
        type="file"
        accept="video/*,image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void importOverlayFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** The mobile stand-in for the Aspect ratio tab: a draggable modal bottom
 * sheet instead of the docked column. Picking Custom drills into a nested
 * sheet for the W:H fields (Base UI stacks and swipe-coordinates it with the
 * parent automatically) rather than expanding in place like the desktop
 * list does — there's no room to grow the sheet taller mid-swipe. */
function AspectDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const picker = useAspectRatioPicker();
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerPortal>
        <DrawerBackdrop />
        <DrawerViewport>
          <DrawerPopup>
            <DrawerContent>
              <DrawerTitle className="text-center">Aspect ratio</DrawerTitle>
              <DrawerDescription className="mb-3 text-center">
                Sets the project&rsquo;s frame shape
              </DrawerDescription>
              <div className="flex flex-col gap-0.5 pb-2">
                <AspectPresetList picker={picker} />
                <Drawer>
                  <DrawerTrigger
                    onClick={() => picker.selectCustom()}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                      picker.showCustomEditor && "bg-muted"
                    )}
                  >
                    <Ratio className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{picker.customLabel}</span>
                    {picker.showCustomEditor && (
                      <Check className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </DrawerTrigger>
                  <DrawerPortal>
                    <DrawerViewport>
                      <DrawerPopup nested>
                        <DrawerContent>
                          <DrawerTitle className="text-center">Custom ratio</DrawerTitle>
                          <div className="mt-3 mb-4 flex justify-center">
                            <AspectCustomFields picker={picker} />
                          </div>
                          <DrawerClose className="w-full rounded-md bg-muted px-3 py-2 text-center text-sm font-medium transition-colors hover:bg-muted/70">
                            Done
                          </DrawerClose>
                        </DrawerContent>
                      </DrawerPopup>
                    </DrawerViewport>
                  </DrawerPortal>
                </Drawer>
              </div>
            </DrawerContent>
          </DrawerPopup>
        </DrawerViewport>
      </DrawerPortal>
    </Drawer>
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

/** How far the pointer has to travel from the press point to reach full
 * shuttle speed, in pixels. */
const SHUTTLE_RANGE = 90;

/** Press-and-drag jog control: distance from the press point sets a rate in
 * [-1, 1] (0 at the press point, ±1 at SHUTTLE_RANGE px out, clamped) and
 * direction. While held, `onTick` fires every animation frame with that rate
 * and the frame's elapsed seconds — the caller turns that into units/second
 * however it likes (playhead seconds, scroll pixels, ...). Releasing stops
 * the loop and snaps the knob back to center; whatever the caller was
 * driving stays wherever it landed. */
function ShuttleBar({ onTick }: { onTick: (rate: number, dt: number) => void }) {
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
          "relative h-12 w-full max-w-56 cursor-ew-resize touch-none rounded-lg border bg-muted select-none",
          dragging ? "border-primary" : "border-border"
        )}
      >
        <div aria-hidden className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-border" />
        <div
          aria-hidden
          className={cn(
            "absolute top-1/2 size-8 -translate-y-1/2 rounded-full border bg-card shadow-sm transition-colors",
            dragging ? "border-primary" : "border-border"
          )}
          style={{ left: `calc(50% + ${rate * (SHUTTLE_RANGE / 2)}px - 16px)` }}
        />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {dragging ? `${rate >= 0 ? "" : "-"}${Math.abs(rate).toFixed(1)}x` : "Press and drag"}
      </span>
    </div>
  );
}

/** Shuttles the timeline's own horizontal scroll — panning the view without
 * touching the playhead or the project. */
function TimelineShuttlePanel() {
  const MAX_PX_PER_SEC = 900;
  return (
    <>
      <PanelHead title="Timeline" hint="Press and drag to pan the timeline" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8">
        <ShuttleBar onTick={(rate, dt) => timelineScrollBy(rate * MAX_PX_PER_SEC * dt)} />
      </div>
    </>
  );
}

/** Shuttles the playhead itself, like a jog wheel — pauses playback first,
 * same as grabbing the ruler does. */
function PlayheadShuttlePanel() {
  const MAX_SECONDS_PER_SEC = 12;
  const startShuttle = (e: React.PointerEvent) => {
    const s = useEditor.getState();
    if (s.playing) s.setPlaying(false);
  };
  return (
    <>
      <PanelHead title="Playhead" hint="Press and drag to shuttle the playhead" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 pb-8" onPointerDownCapture={startShuttle}>
        <ShuttleBar
          onTick={(rate, dt) => {
            const s = useEditor.getState();
            s.seek(s.currentTime + rate * MAX_SECONDS_PER_SEC * dt);
          }}
        />
      </div>
    </>
  );
}
