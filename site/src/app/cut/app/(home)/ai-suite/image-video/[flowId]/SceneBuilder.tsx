"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Loader2,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/cut/lib/time";
import {
  type FlowSceneClip,
  useCreateScene,
  useDeleteScene,
  useExportScene,
  useRemoveSceneClip,
  useReorderSceneClips,
  useRenameScene,
  useScenes,
  useUpdateSceneClip,
} from "@/queries/flows";
import { cn } from "@/lib/utils";

/**
 * Scene Builder — combine completed video clips from this Flow into a
 * sequence. Clips land here via the media menu's "Add to Scene"; this view
 * handles ordering, trimming, sequential preview playback, and export.
 * Deliberately its own lightweight sequencer rather than the Cut editor's
 * full timeline (CutProject's own doc/track model): a scene is a flat,
 * ordered list of whole generations with in/out points, not a multi-track
 * project, so reusing that machinery would mean adapting Flow rows into a
 * shape they were never meant to hold. What IS reused: the export itself
 * runs through the same ffmpeg spawn pattern the Cut export pipeline and
 * the poster-frame capture already use (see cut/server/frames.ts).
 */
export function SceneBuilder({
  flowId,
  onContinueScene,
}: {
  flowId: string;
  /** Extend/Continue Scene lives in the parent (it reuses the composer's
   * own Frames-mode + generate() machinery) — this just asks for it on the
   * scene's last clip and hands back which scene to append the result to. */
  onContinueScene: (clip: FlowSceneClip, sceneId: string) => void;
}) {
  const scenes = useScenes(flowId);
  const createScene = useCreateScene(flowId);
  const deleteScene = useDeleteScene(flowId);
  const renameScene = useRenameScene(flowId);
  const removeClip = useRemoveSceneClip(flowId);
  const updateClip = useUpdateSceneClip(flowId);
  const reorderClips = useReorderSceneClips(flowId);
  const exportScene = useExportScene(flowId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const list = scenes.data?.scenes ?? [];
  const selected = list.find((s) => s.id === selectedId) ?? list[0] ?? null;

  if (scenes.isLoading) {
    return (
      <div className="grid place-items-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (scenes.isError) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load scenes.</p>
        <Button size="sm" variant="outline" onClick={() => scenes.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const newScene = () => {
    createScene.mutate(undefined, { onSuccess: ({ scene }) => setSelectedId(scene.id) });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {list.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelectedId(s.id)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              (selected?.id ?? list[0]?.id) === s.id
                ? "border-foreground bg-foreground text-background"
                : "border-input text-muted-foreground hover:text-foreground"
            )}
          >
            {s.name} ({s.clips.length})
          </button>
        ))}
        <Button size="sm" variant="outline" onClick={newScene} disabled={createScene.isPending}>
          {createScene.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          New scene
        </Button>
      </div>

      {!selected ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No scenes yet — start one, then use &quot;Add to Scene&quot; on a video card.
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border p-3">
          <div className="flex items-center justify-between gap-2">
            {renaming ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => {
                  const trimmed = renameValue.trim();
                  if (trimmed && trimmed !== selected.name) renameScene.mutate({ sceneId: selected.id, name: trimmed });
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  else if (e.key === "Escape") setRenaming(false);
                }}
                className="h-7 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-[13px] outline-none focus-visible:border-ring"
              />
            ) : (
              <button
                type="button"
                className="flex min-w-0 items-center gap-1 text-[13px] font-medium hover:underline"
                onClick={() => {
                  setRenameValue(selected.name);
                  setRenaming(true);
                }}
              >
                <span className="truncate">{selected.name}</span>
                <Pencil className="size-3 shrink-0 text-muted-foreground" />
              </button>
            )}
            <button
              type="button"
              title="Delete scene"
              aria-label="Delete scene"
              onClick={() => {
                if (confirm(`Delete "${selected.name}"? This can't be undone.`)) {
                  deleteScene.mutate(selected.id, {
                    onSuccess: () => setSelectedId(null),
                  });
                }
              }}
              className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          {selected.clips.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-muted-foreground">
              No clips yet. Open a video card&apos;s menu and choose &quot;Add to Scene.&quot;
            </p>
          ) : (
            <>
              <ScenePlayer clips={selected.clips} />
              <div className="space-y-2">
                {selected.clips.map((c, i) => (
                  <SceneClipRow
                    key={c.id}
                    clip={c}
                    isFirst={i === 0}
                    isLast={i === selected.clips.length - 1}
                    onMoveUp={() => {
                      const ids = selected.clips.map((x) => x.id);
                      [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]];
                      reorderClips.mutate({ sceneId: selected.id, clipIds: ids });
                    }}
                    onMoveDown={() => {
                      const ids = selected.clips.map((x) => x.id);
                      [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]];
                      reorderClips.mutate({ sceneId: selected.id, clipIds: ids });
                    }}
                    onTrim={(trim) => updateClip.mutate({ sceneId: selected.id, clipId: c.id, ...trim })}
                    onRemove={() => removeClip.mutate({ sceneId: selected.id, clipId: c.id })}
                    onContinue={i === selected.clips.length - 1 ? () => onContinueScene(c, selected.id) : undefined}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 border-t pt-3">
                {exportScene.isError && (
                  <p className="text-[11px] text-destructive">Export failed — try again.</p>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {selected.exportUrl && (
                    <a
                      href={selected.exportUrl}
                      download={`${selected.name}.mp4`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-[12.5px] font-medium hover:bg-muted"
                    >
                      <Download className="size-3.5" /> Download
                    </a>
                  )}
                  <Button
                    size="sm"
                    onClick={() => exportScene.mutate(selected.id)}
                    disabled={exportScene.isPending || selected.clips.some((c) => !c.outputUrl)}
                  >
                    {exportScene.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Export"}
                  </Button>
                </div>
              </div>
              {selected.clips.some((c) => !c.outputUrl) && (
                <p className="text-[10.5px] text-muted-foreground">
                  Waiting for every clip to finish rendering before export is available.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Sequential playback: one <video> that swaps its source (and seeks to the
 * clip's own trim-in) as each clip ends — a real preview of the cut without
 * needing a merged file, so it works before Export has ever run. */
function ScenePlayer({ clips }: { clips: FlowSceneClip[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clip = clips[Math.min(index, clips.length - 1)];

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !clip) return;
    el.currentTime = clip.trimInSeconds ?? 0;
    if (playing) void el.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the active clip's identity should re-seek
  }, [clip?.id]);

  if (!clip) return null;

  return (
    <div className="space-y-1.5">
      <video
        ref={videoRef}
        src={clip.outputUrl ?? undefined}
        poster={clip.posterUrl ?? undefined}
        playsInline
        controls
        className="w-full rounded-lg bg-black"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          if (clip.trimOutSeconds !== null && el.currentTime >= clip.trimOutSeconds) el.pause();
        }}
        onEnded={() => {
          if (index < clips.length - 1) setIndex(index + 1);
          else setIndex(0);
        }}
      />
      <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
        <Play className="size-3" /> Clip {index + 1} of {clips.length}
      </div>
    </div>
  );
}

function SceneClipRow({
  clip,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onTrim,
  onRemove,
  onContinue,
}: {
  clip: FlowSceneClip;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTrim: (trim: { trimInSeconds?: number | null; trimOutSeconds?: number | null }) => void;
  onRemove: () => void;
  onContinue?: () => void;
}) {
  const dur = clip.durationSeconds ?? 0;
  const inAt = clip.trimInSeconds ?? 0;
  const outAt = clip.trimOutSeconds ?? dur;

  return (
    <div className="flex gap-2 rounded-lg border p-2">
      <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-muted">
        {clip.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL, not a Next-optimizable asset
          <img src={clip.posterUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="truncate text-[11.5px] text-muted-foreground">{clip.prompt}</p>
        {dur > 0 && (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Slider
                min={0}
                max={dur}
                step={0.1}
                value={[inAt, outAt]}
                aria-label="Trim in/out"
                onValueChange={(v) => {
                  const [nextIn, nextOut] = Array.isArray(v) ? v : [v, v];
                  onTrim({ trimInSeconds: nextIn, trimOutSeconds: nextOut });
                }}
              />
            </div>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatTime(inAt)}–{formatTime(outAt)}
            </span>
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <button
          type="button"
          title="Move up"
          disabled={isFirst}
          onClick={onMoveUp}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" />
        </button>
        <button
          type="button"
          title="Move down"
          disabled={isLast}
          onClick={onMoveDown}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ArrowDown className="size-3.5" />
        </button>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-0.5">
        {onContinue && (
          <button
            type="button"
            title="Continue Scene"
            onClick={onContinue}
            className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          title="Remove clip"
          onClick={onRemove}
          className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
