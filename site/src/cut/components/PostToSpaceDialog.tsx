"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileVideo, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatBytes } from "@/cut/components/desktopFolders";
import { brandSpacePostsQueryKey } from "@/queries/brandSpace";
import { postSpaceVideo, spacePostsQueryKey, useCreateSpacePost, useSpacePosts } from "@/queries/space";
import { cn } from "@/lib/utils";

// Posts a finished export to My Space, or to a Brand Space's feed when
// brandSpaceId is given. Deliberately just "attach the video you already
// exported" — the same manual drop-a-file step Artist's Submit already
// uses (there's no render pipeline behind either one; Export is what
// renders, this just uploads what it produced) — rather than re-rendering
// the project itself.
export function PostToSpaceDialog({
  projectId,
  brandSpaceId,
  onClose,
}: {
  projectId: string | null;
  brandSpaceId?: string;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [posting, setPosting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const usage = useSpacePosts();
  const createPost = useCreateSpacePost();

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
      const { post: created } = await createPost.mutateAsync({
        brandSpaceId: brandSpaceId || undefined,
        caption: caption.trim() || undefined,
        projectId,
      });
      await postSpaceVideo(created.id, file, setProgress);
      void queryClient.invalidateQueries({
        queryKey: brandSpaceId ? brandSpacePostsQueryKey(brandSpaceId) : spacePostsQueryKey,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post that video — try again.");
      setPosting(false);
    }
  };

  const usedBytes = usage.data?.usedBytes ?? 0;
  const limitBytes = usage.data?.limitBytes ?? 10 * 1024 ** 3;
  const usagePct = Math.min(100, (usedBytes / limitBytes) * 100);

  return (
    <Dialog open onOpenChange={(open) => !open && !posting && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Post to Space</DialogTitle>
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

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption (optional)"
              maxLength={280}
              rows={2}
              className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring"
            />

            <p className="text-[11px] text-muted-foreground">
              {formatBytes(usedBytes)} of {formatBytes(limitBytes)} used
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${usagePct}%` }} />
            </div>

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
