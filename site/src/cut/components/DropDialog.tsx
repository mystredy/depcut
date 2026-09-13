"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileVideo, Loader2 } from "lucide-react";
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
import { studioDropsQueryKey } from "@/queries/studio";
import { uploadDropVideo, useCreateDrop } from "@/queries/drop";
import { cn } from "@/lib/utils";

// Posts a finished export to a studio's feed as a drop. Deliberately just
// "attach the video you already exported" — the same manual drop-a-file
// step Artist's Submit already uses (there's no render pipeline behind
// either one; Export is what renders, this just uploads what it produced)
// — rather than re-rendering the project itself.
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
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const createDrop = useCreateDrop();

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
    if (!file) return;
    setPosting(true);
    setError(null);
    try {
      const { drop: created } = await createDrop.mutateAsync({
        title: title.trim() || undefined,
        caption: caption.trim() || undefined,
        hashtags: hashtags.trim() || undefined,
        projectId,
        studioId,
      });
      await uploadDropVideo(created.id, file, setProgress);
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
        </DialogHeader>

        {done ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Posted.</p>
        ) : (
          <>
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
                ref={inputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>

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
              <Button disabled={!file || posting} className="w-full" onClick={() => void post()}>
                {posting && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {posting ? `Posting… ${Math.round(progress * 100)}%` : "Post"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
