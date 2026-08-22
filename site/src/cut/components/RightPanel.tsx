"use client";

import { useEffect, useState } from "react";
import { Check, Layers, Ratio, SlidersHorizontal, X } from "lucide-react";
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
import { MEDIA_CORS } from "@/cut/lib/mediaCors";
import { useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { formatTime } from "@/cut/lib/time";
import type { MediaAsset } from "@/cut/lib/types";
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
  const narrow = useNarrowRail();
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

  // On a narrow viewport, Aspect ratio's content moves into the bottom sheet
  // below instead of docking inline — Edit and Overlay still dock at every
  // width, so only that one tab skips the column here.
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
      {narrow && (
        <AspectDrawer open={tab === "aspect"} onOpenChange={(o) => setTab(o ? "aspect" : null)} />
      )}
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
