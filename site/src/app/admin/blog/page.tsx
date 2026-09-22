"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Eye, Newspaper, Pencil, Plus, Tag, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import {
  type AdminBlogPost,
  useAdminBlogPosts,
  useDeleteBlogPost,
  useUpdateBlogPost,
} from "@/queries/admin";

type Filter = "all" | "published" | "draft";

export default function AdminBlogPage() {
  const posts = useAdminBlogPosts();
  const del = useDeleteBlogPost();
  const [confirmDelete, setConfirmDelete] = useState<AdminBlogPost | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const allPosts = posts.data?.posts ?? [];
  const publishedCount = allPosts.filter((p) => p.published).length;
  const draftCount = allPosts.length - publishedCount;
  const filtered =
    filter === "all" ? allPosts : allPosts.filter((p) => (filter === "published") === p.published);

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
        <Link href="/admin/blog/new" className={buttonVariants({})}>
          <Plus className="size-3.5" data-icon="inline-start" /> New post
        </Link>
      </div>

      {posts.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : posts.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load posts. Try again.</p>
      ) : (
        <div className="space-y-3">
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger
              size="sm"
              className="w-fit border-transparent bg-transparent px-1.5 font-medium shadow-none hover:bg-muted"
            >
              <SelectValue>
                {(value: Filter) =>
                  value === "published"
                    ? `Published (${publishedCount})`
                    : value === "draft"
                      ? `Draft (${draftCount})`
                      : `All (${allPosts.length})`
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All ({allPosts.length})</SelectItem>
              <SelectItem value="published">Published ({publishedCount})</SelectItem>
              <SelectItem value="draft">Draft ({draftCount})</SelectItem>
            </SelectContent>
          </Select>

          <div className="space-y-2">
            {filtered.map((p) => (
              <PostRow key={p.id} post={p} onDelete={() => setConfirmDelete(p)} />
            ))}
            {allPosts.length === 0 && (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
                No posts yet — click New post to write the first one.
              </p>
            )}
            {allPosts.length > 0 && filtered.length === 0 && (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
                No posts match this filter.
              </p>
            )}
          </div>
        </div>
      )}

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
              <Trash2 className="size-3.5" data-icon="inline-start" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PostRow({ post: p, onDelete }: { post: AdminBlogPost; onDelete: () => void }) {
  const update = useUpdateBlogPost();
  const [copied, setCopied] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagValue, setTagValue] = useState(p.tag ?? "");

  const saveTag = () => {
    setTagOpen(false);
    const next = tagValue.trim();
    if (next !== (p.tag ?? "")) update.mutate({ id: p.id, tag: next || null });
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {p.hasCoverImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
            <img src={`/api/admin/blog/${p.id}/cover?v=${p.updatedAt}`} alt="" className="size-full object-cover" />
          ) : (
            <Newspaper className="size-5 text-muted-foreground/40" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{p.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="flex items-center gap-1">
              {p.published ? (
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Published</span>
              ) : (
                <span className="font-medium text-amber-600 dark:text-amber-400">Draft</span>
              )}
              <span className="text-muted-foreground">
                ·{" "}
                {new Date(p.published && p.publishedAt ? p.publishedAt : p.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </span>
            {p.tag && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {p.tag}
              </span>
            )}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">/blog/{p.slug}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {p.createdBy && (
          <div className="hidden items-center gap-1.5 sm:flex" title={`Created by ${p.createdBy.displayName ?? p.createdBy.name}`}>
            <UserAvatar
              name={p.createdBy.displayName ?? p.createdBy.name}
              image={p.createdBy.image}
              className="size-6 rounded-full"
              initialClassName="text-[10px]"
            />
            <span className="max-w-24 truncate text-xs font-medium text-muted-foreground">
              {p.createdBy.displayName ?? p.createdBy.name}
            </span>
          </div>
        )}
        <div className="flex items-center gap-0.5">
          {p.published && (
            <>
              <a
                href={`/blog/${p.slug}`}
                target="_blank"
                rel="noreferrer"
                title="View"
                className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
              >
                <Eye className="size-3.5" />
              </a>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Copy link"
                onClick={() => {
                  void navigator.clipboard.writeText(`${DEPCUT_CANONICAL}/blog/${p.slug}`).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  });
                }}
              >
                {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              </Button>
            </>
          )}
          <Popover
            open={tagOpen}
            onOpenChange={(o) => {
              setTagOpen(o);
              if (o) setTagValue(p.tag ?? "");
            }}
          >
            <PopoverTrigger
              render={
                <Button size="icon-sm" variant="ghost" title="Tag">
                  <Tag className="size-3.5" />
                </Button>
              }
            />
            <PopoverContent align="end" className="w-56 p-2">
              <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">Tag this post</p>
              <div className="flex items-center gap-1.5">
                <Input
                  autoFocus
                  value={tagValue}
                  onChange={(e) => setTagValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveTag()}
                  placeholder="Make Money, Tech…"
                  className="h-7 text-xs"
                />
                <Button size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={saveTag}>
                  Save
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Link
            href={`/admin/blog/${p.id}`}
            title="Edit"
            className={buttonVariants({ size: "icon-sm", variant: "ghost" })}
          >
            <Pencil className="size-3.5" />
          </Link>
          <Button size="icon-sm" variant="ghost" title="Delete" onClick={onDelete}>
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}
