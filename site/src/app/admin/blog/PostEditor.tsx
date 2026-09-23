"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Bold,
  Cloud,
  CloudOff,
  Eye,
  ImageUp,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Pencil,
  Quote,
  Send,
  Settings,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  useAdminBlogPosts,
  useCreateBlogPost,
  useRemoveBlogCover,
  useUpdateBlogPost,
  useUploadBlogCover,
} from "@/queries/admin";

import { TagsInput } from "./TagsInput";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Below this width there's not enough room for the editor and a 288px
// settings sidebar side by side. Read via useSyncExternalStore rather than
// a mount effect + setState, so it stays live across an actual window
// resize instead of only being checked once.
const NARROW_VIEWPORT_QUERY = "(max-width: 1023px)";
function subscribeToNarrowViewport(callback: () => void) {
  const mql = window.matchMedia(NARROW_VIEWPORT_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
function isNarrowViewport() {
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}
function isNarrowViewportServer() {
  return false;
}

function ToolbarButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button type="button" size="icon-sm" variant="ghost" title={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </Button>
  );
}

export function PostEditor({ postId }: { postId: string | null }) {
  const router = useRouter();
  const posts = useAdminBlogPosts();
  const post = postId ? (posts.data?.posts.find((p) => p.id === postId) ?? null) : null;
  const create = useCreateBlogPost();
  const update = useUpdateBlogPost();
  const uploadCover = useUploadBlogCover();
  const removeCover = useRemoveBlogCover();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [contentMarkdown, setContentMarkdown] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [published, setPublished] = useState(false);
  const [preview, setPreview] = useState(false);
  // null until the user explicitly clicks the gear — until then, the sidebar
  // just follows the live viewport width (see isNarrowViewport above).
  const [settingsOverride, setSettingsOverride] = useState<boolean | null>(null);
  const narrow = useSyncExternalStore(subscribeToNarrowViewport, isNarrowViewport, isNarrowViewportServer);
  const settingsVisible = settingsOverride ?? !narrow;
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [createdOnce, setCreatedOnce] = useState(false);
  const hasSavedVersion = Boolean(post) || createdOnce;

  // editVersionRef bumps on every field change; savedVersionRef records which
  // version a completed save actually covered. A save's onSuccess only clears
  // dirty when the two still match — if the user changed something else while
  // that request was in flight, editVersionRef has since moved on, dirty stays
  // true, and the effect below schedules the next save with the CURRENT
  // (freshest) field values. savingRef is a synchronous lock so a fired timer
  // can never start a second request while one is already in flight, however
  // pending (react-query's own isPending) happens to be lagging.
  const editVersionRef = useRef(0);
  const savedVersionRef = useRef(0);
  const savingRef = useRef(false);

  // Seeds the form once the real post arrives — guarded so a background
  // refetch (e.g. after the tag popover saves elsewhere) never clobbers
  // whatever's mid-edit here.
  useEffect(() => {
    if (postId && post && loadedId !== post.id) {
      setTitle(post.title);
      setSlug(post.slug);
      setSlugTouched(true);
      setExcerpt(post.excerpt ?? "");
      setContentMarkdown(post.contentMarkdown);
      setAuthorName(post.authorName ?? "");
      setTags(post.tags ?? []);
      setPublished(post.published);
      setLoadedId(post.id);
    }
  }, [postId, post, loadedId]);

  const markDirty = () => {
    editVersionRef.current += 1;
    setDirty(true);
  };

  const applyLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart, value } = el;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const found = value.indexOf("\n", lineStart);
    const lineEnd = found === -1 ? value.length : found;
    const line = value.slice(lineStart, lineEnd);
    const stripped = line.replace(/^(#{1,6}\s+|>\s+)/, "");
    const nextLine = prefix + stripped;
    const next = value.slice(0, lineStart) + nextLine + value.slice(lineEnd);
    setContentMarkdown(next);
    markDirty();
    requestAnimationFrame(() => {
      el.focus();
      const pos = lineStart + nextLine.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const wrapSelection = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const raw = value.slice(s, e) || placeholder;
    // Markdown emphasis can't have whitespace next to its markers — keep any
    // leading/trailing space in the selection outside them, so wrapping
    // "word " still produces valid, renderable "**word** " rather than the
    // dead "**word **" that both Markdown and react-markdown reject.
    const leading = raw.match(/^\s*/)?.[0] ?? "";
    const trailing = raw.slice(leading.length).match(/\s*$/)?.[0] ?? "";
    const core = raw.slice(leading.length, raw.length - trailing.length) || placeholder;
    const next = value.slice(0, s) + leading + before + core + after + trailing + value.slice(e);
    setContentMarkdown(next);
    markDirty();
    requestAnimationFrame(() => {
      el.focus();
      const start = s + leading.length + before.length;
      el.setSelectionRange(start, start + core.length);
    });
  };

  const valid = Boolean(title.trim() && slug.trim() && contentMarkdown.trim());
  const pending = create.isPending || update.isPending;

  // The top-bar button always forces published: true — its label already
  // promises that ("Publish" / "Update"), so it needs to actually do it
  // rather than just re-save whatever the sidebar switch currently holds.
  // Passed as an override instead of going through setPublished() first,
  // since that state update wouldn't be visible in this same synchronous
  // call's closure yet.
  const save = (overrides?: { published?: boolean }) => {
    if (!valid || savingRef.current) return;
    savingRef.current = true;
    setError(null);

    // Captured now, before the request goes out — this is the version of
    // local state this specific payload represents, independent of whatever
    // editVersionRef climbs to while the request is in flight.
    const versionAtSend = editVersionRef.current;
    const nextPublished = overrides?.published ?? published;
    const input = {
      authorName: authorName.trim() || undefined,
      contentMarkdown: contentMarkdown.trim(),
      excerpt: excerpt.trim() || undefined,
      published: nextPublished,
      slug: slug.trim(),
      tags,
      title: title.trim(),
    };
    if (nextPublished !== published) setPublished(nextPublished);

    const onSettled = () => {
      savingRef.current = false;
    };
    const onError = (e: unknown) => {
      setError(e instanceof Error ? e.message : "Couldn't save — try again.");
      onSettled();
    };
    // Only clears dirty if nothing changed after this payload was built —
    // otherwise editVersionRef has moved past versionAtSend, dirty stays
    // true, and the autosave effect (pending flips false on this same
    // settle) schedules a follow-up save with the current field values.
    const onSaved = () => {
      savedVersionRef.current = versionAtSend;
      setDirty(editVersionRef.current !== versionAtSend);
    };

    if (post) {
      update.mutate(
        { id: post.id, ...input },
        {
          onError,
          onSuccess: () => {
            onSaved();
            onSettled();
          },
        }
      );
    } else {
      create.mutate(input, {
        onError,
        onSuccess: (result) => {
          onSaved();
          setCreatedOnce(true);
          // Set before the route change so the "seed form from server post"
          // effect below sees loadedId already matching once `post` arrives
          // from the refetch, instead of re-seeding from the row as it stood
          // at create time and stomping anything typed since.
          setLoadedId(result.post.id);
          router.replace(`/admin/blog/${result.post.id}`);
          onSettled();
        },
      });
    }
  };

  // Autosaves a valid draft shortly after the last keystroke — the Publish
  // button stays for a deliberate "save right now," but nothing here is
  // ever lost waiting for it.
  useEffect(() => {
    if (!dirty || !valid || pending) return;
    const timer = setTimeout(save, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, contentMarkdown, authorName, tags, published, dirty, valid, pending]);

  if (postId && posts.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }
  if (postId && !posts.isLoading && !post) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">This post doesn&apos;t exist anymore.</p>
        <Link href="/admin/blog" className="text-sm text-primary hover:underline">
          ← Back to posts
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Top bar — spans the full width above both the editor and the
          settings sidebar, Blogger's own layout. */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-background pb-3">
        <Link
          href="/admin/blog"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Back to posts"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
            markDirty();
          }}
          placeholder="Title"
          className="min-w-0 flex-1 border-0 border-b-2 border-transparent bg-transparent pb-1 text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-primary"
        />
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          {!hasSavedVersion && !dirty ? (
            <Cloud className="size-3.5 opacity-50" />
          ) : pending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            <>
              <CloudOff className="size-3.5" /> Unsaved
            </>
          ) : (
            <>
              <Cloud className="size-3.5" /> Saved
            </>
          )}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-full"
          onClick={() => setPreview((v) => !v)}
        >
          {preview ? <Pencil className="size-3.5" /> : <Eye className="size-3.5" />}
          {preview ? "Edit" : "Preview"}
        </Button>
        <Button
          type="button"
          disabled={!valid || pending}
          onClick={() => save({ published: true })}
          className="gap-1.5 rounded-full"
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {published ? "Update" : "Publish"}
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 gap-6 pt-3">
        {/* Editor column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-[52px] z-10 flex items-center gap-0.5 rounded-xl border bg-muted px-1.5 py-1">
            <ToolbarButton title="Heading 1" onClick={() => applyLinePrefix("# ")}>
              <span className="text-xs font-semibold">H1</span>
            </ToolbarButton>
            <ToolbarButton title="Heading 2" onClick={() => applyLinePrefix("## ")}>
              <span className="text-xs font-semibold">H2</span>
            </ToolbarButton>
            <ToolbarButton title="Heading 3" onClick={() => applyLinePrefix("### ")}>
              <span className="text-xs font-semibold">H3</span>
            </ToolbarButton>
            <ToolbarButton title="Quote" onClick={() => applyLinePrefix("> ")}>
              <Quote className="size-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton title="Bold" onClick={() => wrapSelection("**", "**", "bold text")}>
              <Bold className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Italic" onClick={() => wrapSelection("*", "*", "italic text")}>
              <Italic className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Link" onClick={() => wrapSelection("[", "](https://)", "link text")}>
              <Link2 className="size-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton title="Bullet list" onClick={() => applyLinePrefix("- ")}>
              <List className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={() => applyLinePrefix("1. ")}>
              <ListOrdered className="size-3.5" />
            </ToolbarButton>
            <div className="flex-1" />
            <ToolbarButton
              title={settingsVisible ? "Hide post settings" : "Show post settings"}
              onClick={() => setSettingsOverride(!settingsVisible)}
            >
              <Settings className="size-3.5" />
            </ToolbarButton>
          </div>

          {post?.hasCoverImage && (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
            <img
              src={`/api/admin/blog/${post.id}/cover?v=${post.updatedAt}`}
              alt=""
              className="mt-6 w-full rounded-2xl border object-cover"
            />
          )}

          <div className="min-h-[60vh] py-6">
            {preview ? (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{contentMarkdown.trim() || "*Nothing to preview yet.*"}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={contentMarkdown}
                onChange={(e) => {
                  setContentMarkdown(e.target.value);
                  markDirty();
                }}
                placeholder="Write in Markdown…"
                className="min-h-[60vh] w-full resize-none border-0 bg-transparent font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            )}
          </div>

          {error && <p className="pb-4 text-sm text-destructive">{error}</p>}
        </div>

        {/* Settings sidebar — Blogger keeps this panel visible alongside the
            editor instead of behind a modal, so post settings (labels,
            published state, permalink, …) stay reachable while writing.
            The toolbar's gear toggles it, same as Blogger's own. */}
        {settingsVisible && (
        <aside className="sticky top-[52px] w-72 shrink-0 self-start">
          <div className="max-h-[calc(100vh-84px)] overflow-y-auto rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Post settings</h2>
            <div className="mt-3 divide-y">
              <div className="space-y-1.5 py-3 first:pt-0">
                <Label className="text-xs">Labels</Label>
                <TagsInput
                  value={tags}
                  onChange={(next) => {
                    setTags(next);
                    markDirty();
                  }}
                  placeholder="Make Money, Tech…"
                />
              </div>

              <div className="flex items-center justify-between gap-3 py-3">
                <div>
                  <Label className="text-sm">Published</Label>
                  <p className="text-xs text-muted-foreground">Live on /blog once on.</p>
                </div>
                <Switch
                  checked={published}
                  onCheckedChange={(v) => {
                    setPublished(v);
                    markDirty();
                  }}
                />
              </div>

              <div className="space-y-1.5 py-3">
                <Label className="text-xs">Permalink</Label>
                <div className="flex items-center gap-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">/blog/</span>
                  <Input
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(slugify(e.target.value));
                      markDirty();
                    }}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5 py-3">
                <Label className="text-xs">Excerpt</Label>
                <Textarea
                  value={excerpt}
                  onChange={(e) => {
                    setExcerpt(e.target.value);
                    markDirty();
                  }}
                  rows={2}
                  placeholder="One or two sentences shown in the blog list and link previews."
                />
              </div>

              <div className="space-y-1.5 py-3">
                <Label className="text-xs">Author</Label>
                <Input
                  value={authorName}
                  onChange={(e) => {
                    setAuthorName(e.target.value);
                    markDirty();
                  }}
                  placeholder="DepCut Team"
                />
              </div>

              <div className="space-y-1.5 py-3 last:pb-0">
                <Label className="text-xs">Cover image</Label>
                {post ? (
                  <div className="flex items-center gap-3">
                    <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                      {post.hasCoverImage ? (
                        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
                        <img
                          src={`/api/admin/blog/${post.id}/cover?v=${post.updatedAt}`}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : (
                        <ImageUp className="size-5 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Button
                        type="button"
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removeCover.isPending}
                          onClick={() => removeCover.mutate(post.id)}
                        >
                          <Trash2 className="size-3.5" data-icon="inline-start" /> Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Save the post once to add a cover image.</p>
                )}
              </div>
            </div>
          </div>
        </aside>
        )}
      </div>
    </div>
  );
}
