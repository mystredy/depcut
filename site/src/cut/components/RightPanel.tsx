"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUpDown,
  AudioLines,
  Crop,
  EyeOff,
  Gauge,
  MoveHorizontal,
  Palette,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { clipLen, useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { cn } from "@/lib/utils";
import {
  ClipExtractSection,
  ClipFramingSection,
  ClipHiddenSection,
  ClipMoveTimeSection,
  ClipMoveTrackSection,
  ClipMuteSection,
  ClipSpeedSection,
  ClipVolumeSection,
  ColorPanel,
  Inspector,
} from "./Inspector";

type ClipTab =
  | "move-time"
  | "move-track"
  | "speed"
  | "color"
  | "volume"
  | "mute"
  | "extract"
  | "hidden"
  | "framing";
type RightTab = "edit" | ClipTab;

/** One clip property per tab, so only one is ever open in the panel at a
 * time instead of all of them stacked in one scrolling form. Each only
 * applies to a selected video or photo clip — the tab shows a placeholder
 * for any other kind of selection. */
const CLIP_TABS: { id: ClipTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "move-time", label: "Move", icon: MoveHorizontal },
  { id: "move-track", label: "Track", icon: ArrowUpDown },
  { id: "speed", label: "Speed", icon: Gauge },
  { id: "color", label: "Color", icon: Palette },
  { id: "volume", label: "Volume", icon: Volume2 },
  { id: "mute", label: "Mute", icon: VolumeX },
  { id: "extract", label: "Extract", icon: AudioLines },
  { id: "hidden", label: "Hidden", icon: EyeOff },
  { id: "framing", label: "Framing", icon: Crop },
];

/** The right rail: focused purely on editing whatever's selected on the
 * timeline — a video, audio, or photo clip. Edit holds the selection
 * inspector (audio clips, text, shapes, effects, stickers); a clip's own
 * properties each get their own tab below it, one panel open at a time.
 * Adding content (Overlay, Media, ...) and project-level tools (Aspect
 * ratio, Timeline, Playhead) all live on the left SidePanel instead — this
 * rail doesn't do anything that isn't "change the thing that's selected." */
export function RightPanel() {
  const hasEditContent = useEditor(
    (s) => s.selection != null && s.selection.kind !== "cue" && s.selection.kind !== "transition"
  );
  const [tab, setTab] = useLocalPref<RightTab | null>(
    "cut-right-tab",
    "edit",
    (v) => v === null || v === "edit" || CLIP_TABS.some((t) => t.id === v)
  );

  // A new selection opens Edit when no tab was already open, or when a clip
  // tab (Speed, Color, ...) was open but the new selection isn't a clip —
  // those tabs only apply to a video or photo clip. Picking another clip
  // while "Speed" is open keeps Speed open rather than bouncing back to Edit.
  const selectionKey = useEditor((s) =>
    s.selection ? `${s.selection.kind}:${s.selection.id}` : null
  );
  const [seenKey, setSeenKey] = useState(selectionKey);
  if (selectionKey !== seenKey) {
    setSeenKey(selectionKey);
    const isClipTab = tab !== null && tab !== "edit";
    if (selectionKey && hasEditContent) {
      const newIsClip = useEditor.getState().selection?.kind === "clip";
      if (tab === null || (isClipTab && !newIsClip)) setTab("edit");
    } else if (isClipTab) {
      // Selection dropped entirely (or moved to a cue/transition) while a
      // clip-only tab was open — its icon just vanished from the rail.
      setTab("edit");
    }
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

  // With a tab open and nothing selected, fall back to whatever clip sits
  // under the playhead on that remembered track/lane instead of leaving the
  // panel on a "select something" placeholder — the playhead crossing into a
  // new clip there re-runs this and follows it. The main track wins over the
  // remembered one whenever the playhead sits on it: it's the through-line
  // of the edit, so it's the safer default regardless of whatever else was
  // last selected (or nothing ever was).
  const currentTime = useEditor((s) => s.currentTime);
  useEffect(() => {
    if (tab === null || hasEditContent) return;
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

  const clip = useEditor((s) =>
    s.selection?.kind === "clip" ? s.clips.find((c) => c.id === s.selection!.id) : undefined
  );

  // Split works off the pointer/playhead, not the selection, so it's always
  // live; Delete needs something picked.
  const split = () => {
    const s = useEditor.getState();
    s.splitAtPlayhead(s.skimTime ?? undefined);
  };
  const selectionCount = useEditor((s) => s.multiSelection.length);
  const deleteSelection = () => useEditor.getState().deleteSelection();

  return (
    <div className="flex min-h-0 border-l border-border bg-card">
      {tab !== null && (
        <div className="flex w-[264px] min-h-0 shrink-0 flex-col border-r border-border">
          {/* Inspector's own sub-panel headers (PanelTitle, ...) run flush to
              the edge with no room reserved for an overlay button, so the
              close button gets its own row here instead of floating on top
              of them. */}
          <div className="flex h-9 shrink-0 items-center pl-2.5">
            <ClosePanelButton onClose={() => setTab(null)} />
          </div>
          {/* A grid cell (rather than another flex child) stretches the
              content to the full remaining height regardless of its own
              root's classes — the same stretch it got for free as Editor's
              direct grid item. */}
          <div className="grid min-h-0 flex-1">
            {tab === "edit" ? (
              hasEditContent ? (
                <Inspector />
              ) : (
                <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                  Select a clip, overlay, or audio clip to edit it here.
                </p>
              )
            ) : clip ? (
              <ScrollArea className="flex min-h-0 flex-col">
                {tab === "move-time" && <ClipMoveTimeSection clip={clip} />}
                {tab === "move-track" && <ClipMoveTrackSection clip={clip} />}
                {tab === "speed" && <ClipSpeedSection clip={clip} />}
                {tab === "color" && <ColorPanel clip={clip} />}
                {tab === "volume" && <ClipVolumeSection clip={clip} />}
                {tab === "mute" && <ClipMuteSection clip={clip} />}
                {tab === "extract" && <ClipExtractSection clip={clip} />}
                {tab === "hidden" && <ClipHiddenSection clip={clip} />}
                {tab === "framing" && <ClipFramingSection clip={clip} />}
              </ScrollArea>
            ) : (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                Select a video or photo clip to use this.
              </p>
            )}
          </div>
        </div>
      )}
      <ScrollArea
        className="min-h-0 w-12 shrink-0 sm:w-[68px]"
        contentClassName="flex flex-col items-center gap-0.5 py-2 sm:gap-1 sm:py-3"
      >
        <RailButton
          label="Edit"
          icon={SlidersHorizontal}
          active={tab === "edit"}
          onClick={() => setTab(tab === "edit" ? null : "edit")}
        />
        {clip && (
          <>
            <div aria-hidden className="my-1 h-px w-8 shrink-0 bg-border" />
            <RailActionButton
              label="Split"
              title="Split at pointer, or at playhead (⌘B or S)"
              icon={Scissors}
              onClick={split}
            />
            <RailActionButton
              label="Delete"
              title={selectionCount > 1 ? `Delete ${selectionCount}` : "Delete (⌫)"}
              icon={Trash2}
              disabled={selectionCount === 0}
              onClick={deleteSelection}
            />
            {CLIP_TABS.map((t) => (
              <RailButton
                key={t.id}
                label={t.label}
                icon={t.icon}
                active={tab === t.id}
                onClick={() => setTab(tab === t.id ? null : t.id)}
              />
            ))}
          </>
        )}
      </ScrollArea>
    </div>
  );
}

function RailButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof SlidersHorizontal;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full min-w-0 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground sm:py-1.5"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-lg transition-colors",
          active ? "bg-foreground/10 text-foreground" : "hover:bg-muted/60"
        )}
      >
        <Icon className="size-4.5" />
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
}

/** A rail tile that fires an action immediately instead of toggling a panel
 * open — Split and Delete, which act on the timeline rather than showing
 * their own view. */
function RailActionButton({
  label,
  title,
  icon: Icon,
  disabled,
  onClick,
}: {
  label: string;
  title?: string;
  icon: typeof SlidersHorizontal;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full min-w-0 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:py-1.5"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="grid size-9 place-items-center rounded-lg transition-colors hover:bg-muted/60">
        <Icon className="size-4.5" />
      </span>
      <span className="hidden w-full truncate text-center text-[10px] font-medium tracking-tight sm:block">
        {label}
      </span>
    </button>
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
