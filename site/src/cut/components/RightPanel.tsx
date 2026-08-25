"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  ArrowUpDown,
  AudioLines,
  Blend,
  CaseSensitive,
  Crop,
  EyeOff,
  Gauge,
  Loader2,
  Move,
  MoveHorizontal,
  Palette,
  PenLine,
  RectangleHorizontal,
  Rows3,
  Scissors,
  SlidersHorizontal,
  Sparkles,
  Sunrise,
  Sunset,
  TextCursorInput,
  Trash2,
  Type,
  UnfoldHorizontal,
  UserRound,
  Volume1,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { clipLen, useEditor } from "@/cut/lib/store";
import { useLocalPref } from "@/cut/lib/uiState";
import { isTextOverlay, type TextOverlay } from "@/cut/lib/types";
import { cn } from "@/lib/utils";
import {
  AudioDuckSection,
  AudioFadeInSection,
  AudioFadeOutSection,
  AudioMoveSection,
  AudioMuteSection,
  AudioSpeedSection,
  AudioTrimSection,
  AudioVolumeSection,
  ClipExtractSection,
  ClipFramingSection,
  ClipMoveTimeSection,
  ClipMoveTrackSection,
  ClipSpeedSection,
  ClipTrimSection,
  ClipVolumeSection,
  ColorPanel,
  Inspector,
  TextAlignSection,
  TextAnimationSection,
  TextBackdropSection,
  TextBehindSpeakerSection,
  TextColorSection,
  TextContentSection,
  TextFontSection,
  TextLineHeightSection,
  TextOutlineSection,
  TextShadowSection,
  TextSizeSection,
  TextSpacingSection,
  TextStyleMemory,
  TextTransformSection,
  TextTrimSection,
} from "./Inspector";

type ClipTab =
  | "trim"
  | "move-time"
  | "move-track"
  | "speed"
  | "color"
  | "volume"
  | "extract"
  | "framing";
type AudioTab =
  | "audio-trim"
  | "audio-move"
  | "audio-speed"
  | "audio-volume"
  | "audio-fade-in"
  | "audio-fade-out"
  | "audio-duck"
  | "audio-mute";
type TextTab =
  | "text-content"
  | "text-trim"
  | "text-font"
  | "text-align"
  | "text-size"
  | "text-color"
  | "text-spacing"
  | "text-line-height"
  | "text-outline"
  | "text-shadow"
  | "text-backdrop"
  | "text-behind-speaker"
  | "text-transform"
  | "text-animation";
type RightTab = "edit" | ClipTab | AudioTab | TextTab;

/** One clip property per tab, so only one is ever open in the panel at a
 * time instead of all of them stacked in one scrolling form. Each only
 * applies to a selected video or photo clip — the tab shows a placeholder
 * for any other kind of selection. */
const CLIP_TABS: { id: ClipTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "trim", label: "Trim", icon: UnfoldHorizontal },
  { id: "move-time", label: "Move", icon: MoveHorizontal },
  { id: "move-track", label: "Track", icon: ArrowUpDown },
  { id: "speed", label: "Speed", icon: Gauge },
  { id: "color", label: "Color", icon: Palette },
  { id: "volume", label: "Volume", icon: Volume2 },
  { id: "extract", label: "Extract", icon: AudioLines },
  { id: "framing", label: "Framing", icon: Crop },
];

/** Same idea, for an audio clip's own properties. */
const AUDIO_TABS: { id: AudioTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "audio-trim", label: "Trim", icon: UnfoldHorizontal },
  { id: "audio-move", label: "Move", icon: MoveHorizontal },
  { id: "audio-speed", label: "Speed", icon: Gauge },
  { id: "audio-volume", label: "Volume", icon: Volume2 },
  { id: "audio-fade-in", label: "Fade in", icon: Sunrise },
  { id: "audio-fade-out", label: "Fade out", icon: Sunset },
  { id: "audio-duck", label: "Duck", icon: Volume1 },
  { id: "audio-mute", label: "Mute", icon: VolumeX },
];

/** Same idea, for a text element's own properties. */
const TEXT_TABS: { id: TextTab; label: string; icon: typeof SlidersHorizontal }[] = [
  { id: "text-content", label: "Text", icon: TextCursorInput },
  { id: "text-trim", label: "Trim", icon: UnfoldHorizontal },
  { id: "text-font", label: "Font", icon: Type },
  { id: "text-align", label: "Align", icon: AlignCenter },
  { id: "text-size", label: "Size", icon: CaseSensitive },
  { id: "text-color", label: "Color", icon: Palette },
  { id: "text-spacing", label: "Spacing", icon: MoveHorizontal },
  { id: "text-line-height", label: "Line height", icon: Rows3 },
  { id: "text-outline", label: "Outline", icon: PenLine },
  { id: "text-shadow", label: "Shadow", icon: Blend },
  { id: "text-backdrop", label: "Backdrop", icon: RectangleHorizontal },
  { id: "text-behind-speaker", label: "Behind", icon: UserRound },
  { id: "text-transform", label: "Transform", icon: Move },
  { id: "text-animation", label: "Animate", icon: Sparkles },
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
    (v) =>
      v === null ||
      v === "edit" ||
      CLIP_TABS.some((t) => t.id === v) ||
      AUDIO_TABS.some((t) => t.id === v) ||
      TEXT_TABS.some((t) => t.id === v)
  );

  // A new selection opens Edit when no tab was already open, or when a clip,
  // audio, or text tab (Speed, Trim, Font, ...) was open but the new
  // selection is a different kind — those tabs only apply to their own kind
  // of selection. Picking another video clip while "Speed" is open keeps
  // Speed open rather than bouncing back to Edit.
  const selectionKey = useEditor((s) =>
    s.selection ? `${s.selection.kind}:${s.selection.id}` : null
  );
  const [seenKey, setSeenKey] = useState(selectionKey);
  if (selectionKey !== seenKey) {
    setSeenKey(selectionKey);
    const isClipTab = tab !== null && CLIP_TABS.some((t) => t.id === tab);
    const isAudioTab = tab !== null && AUDIO_TABS.some((t) => t.id === tab);
    const isTextTab = tab !== null && TEXT_TABS.some((t) => t.id === tab);
    if (selectionKey && hasEditContent) {
      const sel = useEditor.getState().selection;
      const newOverlay =
        sel?.kind === "overlay" ? useEditor.getState().overlays.find((o) => o.id === sel.id) : undefined;
      const newIsText = !!newOverlay && isTextOverlay(newOverlay);
      if (tab === null) setTab("edit");
      else if (isClipTab && sel?.kind !== "clip") setTab("edit");
      else if (isAudioTab && sel?.kind !== "audio") setTab("edit");
      else if (isTextTab && !newIsText) setTab("edit");
    } else if (isClipTab || isAudioTab || isTextTab) {
      // Selection dropped entirely (or moved to a cue/transition) while a
      // clip-, audio-, or text-only tab was open — its icon just vanished
      // from the rail.
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
  const audio = useEditor((s) =>
    s.selection?.kind === "audio" ? s.audioClips.find((c) => c.id === s.selection!.id) : undefined
  );
  const overlay = useEditor((s) =>
    s.selection?.kind === "overlay" ? s.overlays.find((o) => o.id === s.selection!.id) : undefined
  );
  const textOverlay = overlay && isTextOverlay(overlay) ? overlay : undefined;
  const extractingClipId = useEditor((s) => s.extractingClipId);

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
      {textOverlay && <TextStyleMemory overlay={textOverlay} />}
      {/* Edit itself carries no content once a clip, audio, or text clip is
          selected — Split/Delete/its property tabs already show in the rail
          regardless of whether Edit is the active tab, so Edit is then a
          pure toggle with nothing of its own to open. */}
      {tab !== null && !(tab === "edit" && (clip || audio || textOverlay)) && (
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
                {tab === "trim" && <ClipTrimSection clip={clip} />}
                {tab === "move-time" && <ClipMoveTimeSection clip={clip} />}
                {tab === "move-track" && <ClipMoveTrackSection clip={clip} />}
                {tab === "speed" && <ClipSpeedSection clip={clip} />}
                {tab === "color" && <ColorPanel clip={clip} />}
                {tab === "volume" && <ClipVolumeSection clip={clip} />}
                {tab === "extract" && <ClipExtractSection clip={clip} />}
                {tab === "framing" && <ClipFramingSection clip={clip} />}
              </ScrollArea>
            ) : audio ? (
              <ScrollArea className="flex min-h-0 flex-col">
                {tab === "audio-trim" && <AudioTrimSection clip={audio} />}
                {tab === "audio-move" && <AudioMoveSection clip={audio} />}
                {tab === "audio-speed" && <AudioSpeedSection clip={audio} />}
                {tab === "audio-volume" && <AudioVolumeSection clip={audio} />}
                {tab === "audio-fade-in" && <AudioFadeInSection clip={audio} />}
                {tab === "audio-fade-out" && <AudioFadeOutSection clip={audio} />}
                {tab === "audio-duck" && <AudioDuckSection clip={audio} />}
                {tab === "audio-mute" && <AudioMuteSection clip={audio} />}
              </ScrollArea>
            ) : textOverlay ? (
              <ScrollArea className="flex min-h-0 flex-col">
                {tab === "text-content" && <TextContentSection overlay={textOverlay} />}
                {tab === "text-trim" && <TextTrimSection overlay={textOverlay} />}
                {tab === "text-font" && <TextFontSection overlay={textOverlay} />}
                {tab === "text-align" && <TextAlignSection overlay={textOverlay} />}
                {tab === "text-size" && <TextSizeSection overlay={textOverlay} />}
                {tab === "text-color" && <TextColorSection overlay={textOverlay} />}
                {tab === "text-spacing" && <TextSpacingSection overlay={textOverlay} />}
                {tab === "text-line-height" && <TextLineHeightSection overlay={textOverlay} />}
                {tab === "text-outline" && <TextOutlineSection overlay={textOverlay} />}
                {tab === "text-shadow" && <TextShadowSection overlay={textOverlay} />}
                {tab === "text-backdrop" && <TextBackdropSection overlay={textOverlay} />}
                {tab === "text-behind-speaker" && <TextBehindSpeakerSection overlay={textOverlay} />}
                {tab === "text-transform" && <TextTransformSection overlay={textOverlay} />}
                {tab === "text-animation" && <TextAnimationSection overlay={textOverlay} />}
              </ScrollArea>
            ) : CLIP_TABS.some((t) => t.id === tab) ? (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                Select a video or photo clip to use this.
              </p>
            ) : AUDIO_TABS.some((t) => t.id === tab) ? (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                Select an audio clip to use this.
              </p>
            ) : (
              <p className="px-4 py-8 text-center text-xs leading-relaxed text-balance text-muted-foreground">
                Select a text element to use this.
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
          onClick={() => {
            // A clip, audio, or text clip's own tabs are already the way to
            // edit it — Edit carries nothing of its own for them (see the
            // content-pane check below), so for that selection it doubles as
            // a deselect instead of just toggling its own highlight.
            if (clip || audio || textOverlay) {
              useEditor.getState().select(null);
              setTab(null);
              return;
            }
            setTab(tab === "edit" ? null : "edit");
          }}
        />
        {(clip || audio) && (
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
            {clip && (
              <RailActionButton
                label="Hidden"
                title={clip.hidden ? "Show this clip" : "Hide this clip"}
                icon={EyeOff}
                active={!!clip.hidden}
                onClick={() => useEditor.getState().updateClip(clip.id, { hidden: !clip.hidden })}
              />
            )}
            {clip &&
              CLIP_TABS.map((t) => (
                <RailButton
                  key={t.id}
                  label={t.label}
                  icon={t.id === "volume" && clip.muted ? VolumeX : t.icon}
                  active={tab === t.id}
                  busy={t.id === "extract" && extractingClipId === clip.id}
                  title={t.id === "volume" ? "Hold to mute or unmute" : undefined}
                  onLongPress={
                    t.id === "volume"
                      ? () => useEditor.getState().updateClip(clip.id, { muted: !clip.muted })
                      : undefined
                  }
                  onClick={() => setTab(tab === t.id ? null : t.id)}
                />
              ))}
            {audio &&
              AUDIO_TABS.map((t) => (
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
        {textOverlay && (
          <>
            <div aria-hidden className="my-1 h-px w-8 shrink-0 bg-border" />
            {TEXT_TABS.map((t) => (
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
  busy,
  onClick,
  onLongPress,
  title,
}: {
  label: string;
  icon: typeof SlidersHorizontal;
  active: boolean;
  /** Work tied to this tab is still running — shown even while some other
   * tab is open or the panel is closed, since the work outlives either. */
  busy?: boolean;
  onClick: () => void;
  /** Held past the press threshold instead of tapped — a shortcut that
   * skips opening the tab. Suppresses the click that follows the release. */
  onLongPress?: () => void;
  title?: string;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clearPressTimer = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  return (
    <button
      className="flex w-full min-w-0 shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground sm:py-1.5"
      aria-label={label}
      aria-pressed={active}
      title={title}
      onPointerDown={(e) => {
        if (!onLongPress || e.button !== 0) return;
        longPressed.current = false;
        clearPressTimer();
        pressTimer.current = setTimeout(() => {
          longPressed.current = true;
          onLongPress();
        }, 500);
      }}
      onPointerUp={clearPressTimer}
      onPointerLeave={clearPressTimer}
      onClick={() => {
        if (longPressed.current) {
          longPressed.current = false;
          return;
        }
        onClick();
      }}
    >
      <span
        className={cn(
          "relative grid size-9 place-items-center rounded-lg transition-colors",
          active ? "bg-foreground/10 text-foreground" : "hover:bg-muted/60"
        )}
      >
        <Icon className="size-4.5" />
        {busy && (
          <span className="absolute -top-1 -right-1 grid size-[15px] place-items-center rounded-full bg-card ring-2 ring-card">
            <Loader2 className="size-3 animate-spin text-primary" />
          </span>
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
}

/** A rail tile that fires an action immediately instead of toggling a panel
 * open — Split and Delete, which act on the timeline rather than showing
 * their own view. */
function RailActionButton({
  label,
  title,
  icon: Icon,
  disabled,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  icon: typeof SlidersHorizontal;
  disabled?: boolean;
  /** Toggled on, for an action that's a flip rather than a one-shot — Hidden,
   * which has no panel of its own to show its state in. */
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex w-full min-w-0 shrink-0 flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-muted-foreground outline-none transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:py-1.5"
      aria-label={label}
      aria-pressed={active}
      title={title ?? label}
      disabled={disabled}
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
