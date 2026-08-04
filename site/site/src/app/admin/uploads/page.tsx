"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type AdminPlatform,
  type AdminPost,
  type AdminUpload,
  useAdminUploads,
  useCreatePost,
  useUpdatePostState,
} from "@/queries/admin";

const PLATFORMS: AdminPlatform[] = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "threads",
  "snapchat",
  "x",
];

// No per-platform publish integration exists yet (no YouTube/TikTok/etc API
// keys or OAuth) — this is where a publisher manually records what actually
// went out, standing in for that pipeline until it's built.
export default function AdminUploadsPage() {
  const uploads = useAdminUploads();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Uploads & Posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pro submissions' publishing packages. Record each platform post manually — there's no
          publish integration yet.
        </p>
      </div>

      {uploads.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : uploads.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load uploads. Try again.</p>
      ) : uploads.data?.uploads.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-sm text-muted-foreground">
          No uploads yet. They appear here once a creator submits with Pro mode on.
        </div>
      ) : (
        <div className="space-y-4">
          {uploads.data?.uploads.map((upload) => (
            <UploadCard key={upload.id} upload={upload} />
          ))}
        </div>
      )}
    </div>
  );
}

function UploadCard({ upload }: { upload: AdminUpload }) {
  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{upload.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {upload.submission
              ? `${upload.submission.title} · ${upload.submission.user.email}`
              : "No linked submission"}
          </p>
          {upload.tags && (
            <p className="mt-1 truncate text-xs text-muted-foreground">{upload.tags}</p>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">
          {upload.status}
        </span>
      </div>

      <div className="space-y-2">
        {upload.posts.map((post) => (
          <PostRow key={post.id} post={post} />
        ))}
        {upload.posts.length === 0 && (
          <p className="text-xs text-muted-foreground">No posts recorded yet.</p>
        )}
      </div>

      <AddPostForm uploadId={upload.id} />
    </div>
  );
}

function PostRow({ post }: { post: AdminPost }) {
  const updateState = useUpdatePostState();
  const [urlInput, setUrlInput] = useState("");
  const [errorInput, setErrorInput] = useState("");
  const [editing, setEditing] = useState<"published" | "failed" | null>(null);

  const submitPublished = () => {
    if (!urlInput.trim()) return;
    updateState.mutate(
      { postId: post.id, postUrl: urlInput.trim(), state: "published" },
      { onSuccess: () => setEditing(null) }
    );
  };

  const submitFailed = () => {
    if (!errorInput.trim()) return;
    updateState.mutate(
      { errorMessage: errorInput.trim(), postId: post.id, state: "failed" },
      { onSuccess: () => setEditing(null) }
    );
  };

  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase">
            {post.platform ?? "—"}
          </span>
          <StateBadge state={post.state} />
        </div>
        {editing === null && (
          <div className="flex gap-1.5">
            {post.state !== "published" && (
              <Button size="sm" variant="outline" onClick={() => setEditing("published")}>
                Mark published
              </Button>
            )}
            {post.state !== "failed" && (
              <Button size="sm" variant="outline" onClick={() => setEditing("failed")}>
                Mark failed
              </Button>
            )}
            {post.state !== "scheduled" && (
              <Button
                size="sm"
                variant="outline"
                disabled={updateState.isPending}
                onClick={() => updateState.mutate({ postId: post.id, state: "scheduled" })}
              >
                Reset
              </Button>
            )}
          </div>
        )}
      </div>

      {post.text && <p className="mt-2 text-xs text-muted-foreground">{post.text}</p>}

      {post.state === "published" && post.postUrl && (
        <a
          href={post.postUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" /> {post.postUrl}
        </a>
      )}
      {post.state === "failed" && post.errorMessage && (
        <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" /> {post.errorMessage}
        </p>
      )}

      {editing === "published" && (
        <div className="mt-2 flex gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…"
            className="h-8"
          />
          <Button size="sm" disabled={!urlInput.trim() || updateState.isPending} onClick={submitPublished}>
            {updateState.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      )}
      {editing === "failed" && (
        <div className="mt-2 flex gap-2">
          <Input
            value={errorInput}
            onChange={(e) => setErrorInput(e.target.value)}
            placeholder="What went wrong"
            className="h-8"
          />
          <Button size="sm" disabled={!errorInput.trim() || updateState.isPending} onClick={submitFailed}>
            {updateState.isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: AdminPost["state"] }) {
  if (state === "published") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> Published
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
        <AlertCircle className="size-3" /> Failed
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
      <Clock className="size-3" /> Scheduled
    </span>
  );
}

function AddPostForm({ uploadId }: { uploadId: string }) {
  const createPost = useCreatePost();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<AdminPlatform>("youtube");
  const [text, setText] = useState("");
  const [mediaUrls, setMediaUrls] = useState("");

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-3.5" data-icon="inline-start" /> Add post
      </Button>
    );
  }

  const submit = () => {
    createPost.mutate(
      { mediaUrls: mediaUrls.trim() || undefined, platform, text: text.trim() || undefined, uploadId },
      {
        onSuccess: () => {
          setOpen(false);
          setText("");
          setMediaUrls("");
        },
      }
    );
  };

  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-xs">Platform</Label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as AdminPlatform)}>
            <SelectTrigger className="h-8 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Media URL</Label>
          <Input
            className="h-8"
            value={mediaUrls}
            onChange={(e) => setMediaUrls(e.target.value)}
            placeholder="https://…"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Post text</Label>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Caption for this post" />
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" disabled={createPost.isPending} onClick={submit}>
          {createPost.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          Add post
        </Button>
      </div>
    </div>
  );
}
