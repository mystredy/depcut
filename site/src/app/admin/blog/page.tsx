"use client";

import { useRef, useState } from "react";
import { ExternalLink, ImageUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminBlogPost,
  useAdminBlogPosts,
  useCreateBlogPost,
  useDeleteBlogPost,
  useRemoveBlogCover,
  useUpdateBlogPost,
  useUploadBlogCover,
} from "@/queries/admin";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// "new" opens the create dialog; an AdminBlogPost opens it pre-filled for
// editing; null keeps it closed.
type Editing = "new" | AdminBlogPost | null;

export default function AdminBlogPage() {
  const posts = useAdminBlogPosts();
  const del = useDeleteBlogPost();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminBlogPost | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Posts for the public marketing blog at /blog. A draft never shows there until
            published.
          </p>
        </div>
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-3.5" data-icon="inline-start" /> New post
        </Button>
      </div>

      {posts.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : posts.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load posts. Try again.</p>
      ) : (
        <div className="space-y-2">
          {posts.data?.posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{p.title}</p>
                  {p.published ? (
                    <span className="shrink-0 rounded-full border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      Published
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Draft
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  /blog/{p.slug} · updated {new Date(p.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {p.published && (
                  <a
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ size: "sm", variant: "ghost" })}
                  >
                    <ExternalLink className="size-3.5" data-icon="inline-start" /> View
                  </a>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                  <Pencil className="size-3.5" data-icon="inline-start" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmDelete(p)}>
                  <Trash2 className="size-3.5 text-destructive" data-icon="inline-start" />
                </Button>
              </div>
            </div>
          ))}
          {posts.data?.posts.length === 0 && (
            <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
              No posts yet — click New post to write the first one.
            </p>
          )}
        </div>
      )}

      <PostDialog editing={editing} onClose={() => setEditing(null)} />

      <Dialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete &quot;{confirmDelete?.title}&quot;?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the post and its cover image for good. It can&apos;t be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={del.isPending}
              onClick={() => {
                if (!confirmDelete) return;
                del.mutate(confirmDelete.id, { onSuccess: () => setConfirmDelete(null) });
              }}
            >
              {del.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const create = useCreateBlogPost();
  const update = useUpdateBlogPost();
  const uploadCover = useUploadBlogCover();
  const removeCover = useRemoveBlogCover();
  const coverInput = useRef<HTMLInputElement>(null);

  const post = editing === "new" || editing === null ? null : editing;
  const key = editing === "new" ? "new" : (editing?.id ?? "closed");
  const [openKey, setOpenKey] = useState(key);

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [contentMarkdown, setContentMarkdown] = useState(post?.contentMarkdown ?? "");
  const [authorName, setAuthorName] = useState(post?.authorName ?? "");
  const [published, setPublished] = useState(post?.published ?? false);
  const [error, setError] = useState<string | null>(null);

  if (key !== openKey) {
    setOpenKey(key);
    setTitle(post?.title ?? "");
    setSlug(post?.slug ?? "");
    setSlugTouched(false);
    setExcerpt(post?.excerpt ?? "");
    setContentMarkdown(post?.contentMarkdown ?? "");
    setAuthorName(post?.authorName ?? "");
    setPublished(post?.published ?? false);
    setError(null);
  }

  const valid = title.trim() && slug.trim() && contentMarkdown.trim();

  const save = () => {
    if (!valid) return;
    setError(null);
    const input = {
      authorName: authorName.trim() || undefined,
      contentMarkdown: contentMarkdown.trim(),
      excerpt: excerpt.trim() || undefined,
      published,
      slug: slug.trim(),
      title: title.trim(),
    };
    const onError = (e: unknown) =>
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
    if (post) {
      update.mutate({ id: post.id, ...input }, { onSuccess: onClose, onError });
    } else {
      create.mutate(input, { onSuccess: onClose, onError });
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{post ? `Edit ${post.title}` : "New post"}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs">Title</Label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug</Label>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted-foreground">/blog/</span>
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Excerpt</Label>
            <Textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              placeholder="One or two sentences shown in the blog list and link previews."
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Author</Label>
            <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="DepCut Team" />
          </div>
          {post && (
            <div className="space-y-1.5">
              <Label className="text-xs">Cover image</Label>
              <div className="flex items-center gap-3">
                <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                  {post.hasCoverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
                    <img src={`/api/admin/blog/${post.id}/cover?v=${post.updatedAt}`} alt="" className="size-full object-cover" />
                  ) : (
                    <ImageUp className="size-5 text-muted-foreground/50" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploadCover.isPending}
                    onClick={() => coverInput.current?.click()}
                  >
                    {uploadCover.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                    {post.hasCoverImage ? "Replace" : "Upload"}
                  </Button>
                  <input
                    ref={coverInput}
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) uploadCover.mutate({ file, id: post.id });
                    }}
                  />
                  {post.hasCoverImage && (
                    <Button variant="outline" size="sm" disabled={removeCover.isPending} onClick={() => removeCover.mutate(post.id)}>
                      <Trash2 className="size-3.5" data-icon="inline-start" /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Content (Markdown)</Label>
            <Textarea
              value={contentMarkdown}
              onChange={(e) => setContentMarkdown(e.target.value)}
              rows={16}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Published</Label>
              <p className="text-xs text-muted-foreground">Live on /blog once on.</p>
            </div>
            <Switch checked={published} onCheckedChange={setPublished} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid || pending} onClick={save}>
            {pending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
