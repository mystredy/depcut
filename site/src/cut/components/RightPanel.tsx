"use client";

import { useEffect, useRef, useState } from "react";
import { Layers, Loader2, SlidersHorizontal, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { importFileToProject } from "@/cut/lib/media";
import { clipLen, useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { cn } from "@/lib/utils";
import { Inspector } from "./Inspector";

type RightTab = "edit";
/** Every rail icon, including "overlay" which isn't a panel tab at all — it
 * fires an action directly instead of toggling one open. */
type RailId = RightTab | "overlay";

const TABS: { id: RailId; label: string; icon: typeof Layers }[] = [
  { id: "edit", label: "Edit", icon: SlidersHorizontal },
  { id: "overlay", label: "Overlay", icon: Layers },
];

/** The right rail: Edit holds the selection inspector — the whole of the old
 * Inspector column. Overlay isn't a panel; tapping it goes straight to a
 * file picker and adds the result to the overlay track, the same as the
 * Media card's own "Add overlay" action, rather than opening a picker panel
 * first. Aspect ratio, Timeline, and Playhead moved to the left SidePanel. */
export function RightPanel() {
  const hasEditContent = useEditor(
    (s) => s.selection != null && s.selection.kind !== "cue" && s.selection.kind !== "transition"
  );
  const [tab, setTab] = useLocalPref<RightTab | null>(
    "cut-right-tab",
    "edit",
    (v) => v === null || v === "edit"
  );

  // A new selection with its own panel jumps here automatically, the way the
  // old always-on Inspector column used to just appear — including the clip
  // Overlay's import just added.
  const selectionKey = useEditor((s) =>
    s.selection ? `${s.selection.kind}:${s.selection.id}` : null
  );
  const [seenKey, setSeenKey] = useState(selectionKey);
  if (selectionKey !== seenKey) {
    setSeenKey(selectionKey);
    if (selectionKey && hasEditContent) setTab("edit");
  }

  // Remembers the track (video) or lane (audio) a clip selection was last
  // made on — not cleared when the selection is dropped, only replaced by
  // the next one.
  const lastTrack = useRef<{ kind: "clip"; track: number } | { kind: "audio"; lane: number } | null>(
    null
  );
  useEffect(() => {
    const s = useEditor.getState();
    if (s.selection?.kind === "clip") {
      const c = s.clips.find((c) => c.id === s.selection!.id);
      if (c) lastTrack.current = { kind: "clip", track: c.track };
    } else if (s.selection?.kind === "audio") {
      const c = s.audioClips.find((c) => c.id === s.selection!.id);
      if (c) lastTrack.current = { kind: "audio", lane: c.lane ?? 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  // With Edit open and nothing selected, fall back to whatever clip sits
  // under the playhead on that remembered track/lane instead of leaving the
  // panel on the "select something" placeholder — the playhead crossing
  // into a new clip there re-runs this and follows it. The main track wins
  // over the remembered one whenever the playhead sits on it: it's the
  // through-line of the edit, so it's the safer default regardless of
  // whatever else was last selected (or nothing ever was).
  const currentTime = useEditor((s) => s.currentTime);
  useEffect(() => {
    if (tab !== "edit" || hasEditContent) return;
    const s = useEditor.getState();
    const t = s.currentTime;
    const onMain = s.clips.find((c) => c.track === 0 && c.start <= t && t < c.start + clipLen(c));
    if (onMain) {
      s.select({ kind: "clip", id: onMain.id });
      return;
    }
    const remembered = lastTrack.current;
    if (!remembered) return;
    if (remembered.kind === "clip") {
      const hit = s.clips.find(
        (c) => c.track === remembered.track && c.start <= t && t < c.start + clipLen(c)
      );
      if (hit) s.select({ kind: "clip", id: hit.id });
    } else {
      const hit = s.audioClips.find(
        (c) => (c.lane ?? 0) === remembered.lane && c.start <= t && t < c.start + clipLen(c)
      );
      if (hit) s.select({ kind: "audio", id: hit.id });
    }
  }, [tab, hasEditContent, currentTime]);

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

  return (
    <div className="flex min-h-0 border-l border-border bg-card">
      {tab === "edit" && (
        <div className="flex w-[264px] min-h-0 shrink-0 flex-col border-r border-border">
          {/* Inspector's own sub-panel headers (ClipHead, PanelTitle, ...)
              run flush to the edge with no room reserved for an overlay
              button, so the close button gets its own row here instead of
              floating on top of them. */}
          <div className="flex h-9 shrink-0 items-center pl-2.5">
            <ClosePanelButton onClose={() => setTab(null)} />
          </div>
          {/* A grid cell (rather than another flex child) stretches
              Inspector to the full remaining height regardless of its own
              root's classes — the same stretch it got for free as Editor's
              direct grid item. */}
          <div className="grid min-h-0 flex-1">
            {hasEditContent ? (
              <Inspector />
            ) : (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                Select a clip, overlay, or audio clip to edit it here.
              </p>
            )}
          </div>
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

function ClosePanelButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      aria-label="Close panel"
      title="Close panel"
      className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      onClick={onClose}
    >
      <X className="size-4" />
    </button>
  );
}
