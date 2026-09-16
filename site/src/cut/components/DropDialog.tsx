"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileVideo, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/cut/components/desktopFolders";
import { getBackend } from "@/cut/lib/backend";
import { createExportJob, originalSettings, pollExport } from "@/cut/lib/exportClient";
import { canRenderInBrowser, renderProjectToMp4 } from "@/cut/lib/exportRender";
import { useEditor } from "@/cut/lib/store";
import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { PLATFORM_ICONS } from "@/lib/marketplace/platform-icons";
import { studioDropsQueryKey, useStudioWorkflows } from "@/queries/studio";
import { uploadDropVideo, useCreateDrop } from "@/queries/drop";
import { cn } from "@/lib/utils";

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
  onClose,
}: {
  projectId: string | null;
  studioId: string;
  studioName: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [posting, setPosting] = useState(false);
  const [phase, setPhase] = useState<"export" | "upload">("upload");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const queryClient = useQueryClient();
  const createDrop = useCreateDrop();
  const workflows = useStudioWorkflows(studioId);
  // The exact set social-workflow-publish.ts reads when this Drop finishes
  // uploading — shown so posting isn't a surprise about where it lands.
  const autoPublishTargets = (workflows.data?.workflows ?? []).filter(
    (w) => w.autoPublish && w.status === "Active" && w.sourceConnection.platform === STUDIO_SOURCE_PLATFORM
  );

  const pick = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setError("That doesn't look like a video file.");
      return;
    }
    setError(null);
    setFile(f);
  };

  const post = async () => {
    if (!projectId && !file) return;
    setPosting(true);
    setError(null);
    setProgress(0);
    try {
      const { drop: created } = await createDrop.mutateAsync({
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
        projectId,
        studioId,
      });
      let toUpload = file;
      let cleanupExport: (() => Promise<void>) | undefined;
      if (projectId) {
        setPhase("export");
        const exported = await exportCurrentProject(projectId, setProgress);
        toUpload = exported.file;
        cleanupExport = exported.cleanup;
      }
      setPhase("upload");
      setProgress(0);
      try {
        await uploadDropVideo(created.id, toUpload!, setProgress);
      } finally {
        await cleanupExport?.();
      }
      void queryClient.invalidateQueries({ queryKey: studioDropsQueryKey(studioId) });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post that video — try again.");
      setPosting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !posting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New drop</DialogTitle>
          <DialogDescription>
            Posting to <span className="font-medium text-foreground">{studioName}</span>
          </DialogDescription>
          {autoPublishTargets.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {autoPublishTargets.map((w) => {
                const c = w.destinationConnection;
                const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
                return (
                  <div key={w.id} className="flex items-center gap-1.5">
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
                    <span className="text-xs font-medium text-foreground">{c.accountName}</span>
                  </div>
                );
              })}
            </div>
          )}
        </DialogHeader>

        {done ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Posted.</p>
        ) : (
          <>
            {!projectId && (
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
                <span className="text-xs font-medium">
                  {file ? file.name : "Drop a video, or click to browse"}
                </span>
                {file && (
                  <span className="text-[11px] text-muted-foreground">{formatBytes(file.size)}</span>
                )}
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => pick(e.target.files?.[0])}
                />
              </label>
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              maxLength={100}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Description (optional)"
              maxLength={280}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />

            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="Hashtags, space or comma separated (optional)"
              maxLength={280}
              className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <DialogFooter className="mt-2">
              <Button
                disabled={(!projectId && !file) || posting}
                className="w-full"
                onClick={() => void post()}
              >
                {posting && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {posting
                  ? `${phase === "export" ? "Exporting" : "Posting"}… ${Math.round(progress * 100)}%`
                  : "Post"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
