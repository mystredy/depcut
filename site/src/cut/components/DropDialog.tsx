"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Check, FileVideo, Globe2, Link2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatBytes } from "@/cut/components/desktopFolders";
import { getBackend } from "@/cut/lib/backend";
import { createExportJob, originalSettings, pollExport } from "@/cut/lib/exportClient";
import { canRenderInBrowser, renderProjectToMp4 } from "@/cut/lib/exportRender";
import { useEditor } from "@/cut/lib/store";
import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { PLATFORM_ICONS } from "@/lib/marketplace/platform-icons";
import { studioDropsQueryKey, useStudioWorkflows } from "@/queries/studio";
import { publishDrop, uploadDropVideo, useCreateDrop, type DropVisibility } from "@/queries/drop";
import { cn } from "@/lib/utils";

const VISIBILITY_OPTIONS: { value: DropVisibility; label: string; description: string; icon: typeof Globe2 }[] = [
  { description: "Anyone can search for and view", icon: Globe2, label: "Public", value: "public" },
  { description: "Anyone with the link can view", icon: Link2, label: "Unlisted", value: "unlisted" },
  { description: "Only this studio's managers can view", icon: Lock, label: "Private", value: "private" },
];

// datetime-local's value has no timezone — the browser already renders and
// parses it in the visitor's own local time, so round-tripping through Date
// (both directions) is what makes "3:30 PM" mean the same 3:30 PM the
// manager actually picked rather than silently drifting to UTC.
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Renders the current cut and uploads the result — same render pipeline
// Export uses, just handed straight to the drop instead of landing in the
// Exports list first. Opened with no project (the studio page's own "Add
// drop" button) there's no live edit to render, so that path keeps the
// manual attach-a-file step instead.
//
// A qualifying cloud project renders straight to a File in this tab —
// exactly what Export's in-browser path does, minus its own upload to
// export storage and the job-registration round trip, since nothing here
// needs the result to land in the Exports list first. `cleanup`, when
// present, must run only after the caller is done reading the file (Export's
// own scratch-space contract).
async function exportCurrentProject(
  projectId: string,
  onProgress: (ratio: number) => void
): Promise<{ file: File; cleanup?: () => Promise<void> }> {
  const s = useEditor.getState();
  const doc = {
    aspect: s.aspect,
    assets: s.assets,
    clips: s.clips,
    audioClips: s.audioClips,
    overlays: s.overlays,
    subtitles: s.subtitles,
    fadeIn: s.fadeIn,
    fadeOut: s.fadeOut,
  };
  const settings = originalSettings(doc.aspect, doc.clips, doc.assets);
  const backend = getBackend();
  const inBrowser = backend.kind === "cloud" && (await canRenderInBrowser(doc, settings));

  if (inBrowser) {
    const rendered = await renderProjectToMp4(doc, settings, {
      resolve: (asset) => useEditor.getState().assets.find((a) => a.id === asset.id)?.url ?? asset.url,
      onProgress: ({ ratio }) => onProgress(ratio),
    });
    return { file: rendered.file, cleanup: rendered.discard };
  }

  // No in-tab render path (a local-Mac project, or one too big/long for the
  // browser): the engine renders it, so the finished file has to come back
  // over the wire once the job settles.
  const jobId = await createExportJob(projectId, doc, settings);
  await pollExport(jobId, (_stage, ratio) => onProgress(ratio));
  const res = await backend.fetch(`/api/cut/export/${jobId}/file`);
  if (!res.ok) throw new Error("Couldn't fetch the rendered video.");
  const blob = await res.blob();
  const name = `${s.projectName.replace(/[/\\:*?"<>|]/g, "").trim().slice(0, 60) || "export"}.mp4`;
  return { file: new File([blob], name, { type: "video/mp4" }) };
}

export function DropDialog({
  projectId,
  studioId,
  studioName,
  resumeDrop,
  onClose,
}: {
  projectId: string | null;
  studioId: string;
  studioName: string;
  // A drop already uploaded to "draft" (see /api/drops/[id]/complete) —
  // picked up from the studio grid's Draft card to finish posting it,
  // instead of starting a new upload.
  resumeDrop?: { id: string; title: string | null; caption: string | null; hashtags: string[]; fileName: string | null };
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(resumeDrop?.title ?? "");
  const [caption, setCaption] = useState(resumeDrop?.caption ?? "");
  const [hashtags, setHashtags] = useState(resumeDrop?.hashtags.map((t) => `#${t}`).join(" ") ?? "");
  const [dragOver, setDragOver] = useState(false);
  // dropId/uploadState track the background upload kicked off by pick() —
  // separate from posting, which is only the explicit "Post" (finalize) call.
  const [dropId, setDropId] = useState<string | null>(resumeDrop?.id ?? null);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "ready" | "error">(
    resumeDrop ? "ready" : "idle"
  );
  const [posting, setPosting] = useState(false);
  const [phase, setPhase] = useState<"export" | "upload" | "finalize">("upload");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [visibility, setVisibility] = useState<DropVisibility>("public");
  const [scheduling, setScheduling] = useState(false);
  // Defaults to an hour out the first time scheduling is turned on, rather
  // than blank — a picker with nothing selected reads as broken.
  const [scheduledAt, setScheduledAt] = useState(() => toDatetimeLocalValue(new Date(Date.now() + 60 * 60_000)));
  // Parsing scheduledAt is pure (no wall-clock read); comparing it against
  // "now" is not, so that check happens only inside post() itself — an
  // event handler, not render — never here.
  const scheduledDate = scheduling ? new Date(scheduledAt) : null;
  // Which of this drop's own auto-publish targets to leave out this one
  // time — the "Repurpose new posts" workflow itself stays on, only this
  // drop skips it. Only takes effect when posting now: a scheduled drop's
  // eventual publish (dropScheduleSweep.ts) has no way to see this choice.
  const [skipConnectionIds, setSkipConnectionIds] = useState<Set<string>>(new Set());

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Revoke the previous blob URL whenever a new one replaces it, or the
  // dialog unmounts — otherwise every dropped file leaks its object URL.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const queryClient = useQueryClient();
  const createDrop = useCreateDrop();
  const workflows = useStudioWorkflows(studioId);

  // Hold the real header off until the auto-publish targets it shows are
  // known — popping in a row of accounts once the query resolves reads as
  // broken, not loading. The dialog itself still opens right away, just
  // with a spinner in place of its content, so the click has an immediate
  // response instead of a beat of nothing.
  if (workflows.isPending) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-sm">
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // The exact set social-workflow-publish.ts reads when this Drop finishes
  // uploading — shown so posting isn't a surprise about where it lands.
  const autoPublishTargets = (workflows.data?.workflows ?? []).filter(
    (w) => w.autoPublish && w.status === "Active" && w.sourceConnection.platform === STUDIO_SOURCE_PLATFORM
  );

  const currentFields = () => ({
    title: title.trim() || undefined,
    caption: caption.trim() || undefined,
    hashtags: hashtags.trim() || undefined,
  });

  const publishOptions = () => ({
    ...currentFields(),
    scheduledFor: scheduling && scheduledDate ? scheduledDate.toISOString() : null,
    skipConnectionIds: Array.from(skipConnectionIds),
    visibility,
  });

  // Start uploading to R2 the moment a file is picked or dropped — this is
  // *not* posting it. The drop lands as "draft" (see complete/route.ts) and
  // stays that way, playable from the studio's grid as a Draft card, until
  // the explicit "Post" click below actually publishes it. Closing this
  // dialog (or reloading the page) mid-upload doesn't lose anything — the
  // upload keeps running and the drop is already a real draft once it lands.
  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That doesn't look like a video file.");
      return;
    }
    setError(null);
    setFile(f);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    void startUpload(f);
  };

  const startUpload = async (f: File) => {
    setUploadState("uploading");
    setProgress(0);
    try {
      const { drop: created } = await createDrop.mutateAsync({ ...currentFields(), projectId: null, studioId });
      setDropId(created.id);
      await uploadDropVideo(created.id, f, setProgress);
      setUploadState("ready");
      void queryClient.invalidateQueries({ queryKey: studioDropsQueryKey(studioId) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't upload that video — try again.");
      setUploadState("error");
    }
  };

  const post = async () => {
    if (scheduling && (!scheduledDate || Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now())) {
      setError("Pick a time in the future, or turn scheduling off to post now.");
      return;
    }
    setPosting(true);
    setError(null);
    try {
      if (dropId) {
        // The video already finished uploading in the background (or this
        // is a resumed draft) — just finalize it with whatever's typed now.
        setPhase("finalize");
        await publishDrop(dropId, publishOptions());
      } else {
        // Editor "Post to Space" flow: no earlier pick() to have started
        // this, so render, upload, and finalize in one shot.
        if (!projectId) return;
        const { drop: created } = await createDrop.mutateAsync({ ...currentFields(), projectId, studioId });
        setPhase("export");
        setProgress(0);
        const exported = await exportCurrentProject(projectId, setProgress);
        setPhase("upload");
        setProgress(0);
        try {
          await uploadDropVideo(created.id, exported.file, setProgress);
        } finally {
          await exported.cleanup?.();
        }
        setPhase("finalize");
        await publishDrop(created.id, publishOptions());
      }
      void queryClient.invalidateQueries({ queryKey: studioDropsQueryKey(studioId) });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post that video — try again.");
      setPosting(false);
    }
  };

  const canPost = projectId !== null || uploadState === "ready";

  return (
    <Dialog open onOpenChange={(open) => !open && !posting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{resumeDrop ? "Finish this drop" : "New drop"}</DialogTitle>
          <DialogDescription>
            Posting to <span className="font-medium text-foreground">{studioName}</span>
          </DialogDescription>
          {autoPublishTargets.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                {scheduling ? "Will also auto-post to:" : "Also posts to:"}
              </span>
              {autoPublishTargets.map((w) => {
                const c = w.destinationConnection;
                const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
                const skipped = skipConnectionIds.has(c.id);
                return (
                  <div key={w.id} className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      {c.profileImage ? (
                        <div className="relative size-6 shrink-0">
                          <div className="size-6 overflow-hidden rounded-full bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element -- external platform avatar */}
                            <img src={c.profileImage} alt="" className="size-full object-cover" />
                          </div>
                          <Icon className="absolute -right-1 -bottom-1 size-3 rounded-[25%] ring-2 ring-background" />
                        </div>
                      ) : (
                        <Icon className="size-6 shrink-0 rounded-[25%]" />
                      )}
                      <span
                        className={cn(
                          "truncate text-xs font-medium",
                          skipped ? "text-muted-foreground line-through" : "text-foreground"
                        )}
                      >
                        {c.accountName}
                      </span>
                    </div>
                    <Switch
                      checked={!skipped}
                      onCheckedChange={(checked) =>
                        setSkipConnectionIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                      disabled={posting || scheduling}
                      aria-label={`Post this drop to ${c.accountName}`}
                    />
                  </div>
                );
              })}
              {scheduling && (
                <span className="text-[11px] text-muted-foreground">
                  Picking platforms isn't available for scheduled posts yet.
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {done ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {scheduling ? "Scheduled." : "Posted."}
          </p>
        ) : (
          <>
            {!projectId && (previewUrl || resumeDrop ? (
              <div className="flex flex-col gap-1">
                <div className="relative h-48 w-full overflow-hidden rounded-xl border border-border bg-black">
                  <video
                    key={previewUrl ?? resumeDrop?.id}
                    src={previewUrl ?? `/api/drops/${resumeDrop?.id}/video`}
                    className="size-full object-contain"
                    controls={uploadState === "ready"}
                    muted
                    playsInline
                    preload="auto"
                  />
                  {uploadState === "uploading" && (
                    <>
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 text-white">
                        <Loader2 className="size-5 animate-spin" />
                        <span className="text-xs font-medium">Uploading… {Math.round(progress * 100)}%</span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                        <div
                          className="h-full bg-primary transition-[width]"
                          style={{ width: `${Math.round(progress * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                  {uploadState === "error" && (
                    <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-2 bg-black/70 text-center text-white">
                      <span className="text-xs font-medium text-red-300">Upload failed</span>
                      <span className="text-[11px] underline underline-offset-2">Click to retry</span>
                      <input
                        type="file"
                        accept="video/*"
                        className="hidden"
                        onChange={(e) => pick(e.target.files?.[0])}
                      />
                    </label>
                  )}
                  {uploadState === "ready" && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                      <Check className="size-3" />
                      Ready
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 px-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate">{file?.name ?? resumeDrop?.fileName ?? "Video uploaded"}</span>
                  {file && <span className="shrink-0">{formatBytes(file.size)}</span>}
                </div>
              </div>
            ) : (
              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pick(e.dataTransfer.files[0]);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                )}
              >
                <FileVideo className="size-6 text-muted-foreground" />
                <span className="text-xs font-medium">Drop a video, or click to browse</span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              </label>
            ))}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={100}
              disabled={posting}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-60"
            />

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Description — #hashtags and @mentions welcome (optional)"
              maxLength={280}
              rows={2}
              disabled={posting}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-60"
            />

            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="Up to 5 tags, space or comma separated (optional)"
              maxLength={280}
              disabled={posting}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring disabled:opacity-60"
            />

            <Select value={visibility} onValueChange={(v) => setVisibility(v as DropVisibility)}>
              <SelectTrigger disabled={posting} size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex flex-col">
                      <span>{label}</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{description}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-2 rounded-lg border border-input px-2.5 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm">
                  <CalendarClock className="size-3.5 text-muted-foreground" />
                  Schedule for later
                </span>
                <Switch checked={scheduling} onCheckedChange={setScheduling} disabled={posting} aria-label="Schedule for later" />
              </div>
              {scheduling && (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={toDatetimeLocalValue(new Date())}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  disabled={posting}
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring disabled:opacity-60"
                />
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DialogFooter className="mt-2">
              <Button disabled={!canPost || posting} className="w-full" onClick={() => void post()}>
                {(posting || uploadState === "uploading") && (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                )}
                {posting
                  ? phase === "export"
                    ? `Exporting… ${Math.round(progress * 100)}%`
                    : phase === "upload"
                      ? `Uploading… ${Math.round(progress * 100)}%`
                      : scheduling
                        ? "Scheduling…"
                        : "Posting…"
                  : uploadState === "uploading"
                    ? `Uploading… ${Math.round(progress * 100)}%`
                    : scheduling
                      ? "Schedule"
                      : "Post"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
