"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { EditorContent, generateJSON, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, type MarkdownStorage } from "tiptap-markdown";
import {
  ArrowLeft,
  Bold,
  ChevronDown,
  Cloud,
  CloudOff,
  CodeXml,
  FileCode,
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
  Sparkles,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/queries/apiClient";
import {
  adminBlogPostsQueryKey,
  useAdminBlogPosts,
  useCreateBlogPost,
  useRemoveBlogCover,
  useUpdateBlogPost,
  useUploadBlogCover,
} from "@/queries/admin";

import { BlogChatPanel } from "./BlogChatPanel";
import type { BlogEditorActions } from "./aiChat/tools";
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

const FALLBACK_TITLE = "Untitled post";

// A slug for a draft that has no title yet — derived from the opening words
// of the body so it's still recognizable, plus a short random suffix so two
// untitled drafts starting the same way never collide.
function fallbackSlug(content: string): string {
  const base = slugify(content.trim().slice(0, 60)) || "post";
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
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

// Mirrors Blogger's own "Paragraph" style dropdown — one menu instead of a
// button per level. `prefix` is what applyLinePrefix uses in Markdown mode;
// `level` is what the Compose editor's heading command uses — null means a
// plain paragraph in both.
const PARAGRAPH_STYLES: { label: string; prefix: string; level: 1 | 2 | 3 | 4 | null }[] = [
  { label: "Normal", prefix: "", level: null },
  { label: "Major heading", prefix: "# ", level: 1 },
  { label: "Heading", prefix: "## ", level: 2 },
  { label: "Subheading", prefix: "### ", level: 3 },
  { label: "Minor heading", prefix: "#### ", level: 4 },
];

// Shared by the Compose editor and by HTML view's generateJSON parse, so
// typed HTML is always read into the exact same schema Compose renders with.
const COMPOSE_EXTENSIONS = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    link: { openOnClick: false },
  }),
  Markdown.configure({ html: false }),
];

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
  const queryClient = useQueryClient();
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
  // "compose" is a real WYSIWYG editor (bold looks bold, no `**` visible) —
  // Blogger's own default. "markdown" is the raw source this project stores
  // and sends to the server. "html" is the rendered HTML of that same
  // document, editable like Blogger's own "HTML view" — typing there re-
  // parses into the Compose doc, which re-derives contentMarkdown from it.
  const [mode, setMode] = useState<"compose" | "markdown" | "html">("compose");
  const [htmlDraft, setHtmlDraft] = useState("");
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  // null until the user explicitly clicks the gear — until then, the sidebar
  // just follows the live viewport width (see isNarrowViewport above).
  const [settingsOverride, setSettingsOverride] = useState<boolean | null>(null);
  const narrow = useSyncExternalStore(subscribeToNarrowViewport, isNarrowViewport, isNarrowViewportServer);
  const settingsVisible = settingsOverride ?? !narrow;
  const [error, setError] = useState<string | null>(null);
  // True only while a save started BY CLICKING the Publish/Update button is
  // in flight — separate from the generic `pending` below, which is also
  // true during routine autosave. Drives just the button's own spinner, so
  // a background autosave tick doesn't make the button look like it's
  // publishing when nobody touched it.
  const [publishPending, setPublishPending] = useState(false);
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

  const markDirty = () => {
    editVersionRef.current += 1;
    setDirty(true);
  };

  // The WYSIWYG editor for Compose mode. Content is stored as Markdown
  // (contentMarkdown, unchanged on the server and public site) — the
  // Markdown extension parses it in and serializes edits back out.
  // Recreated (deps below) when mode flips into "compose", or when loadedId
  // moves to a genuinely different post. loadedId only ever changes right
  // after a fresh mount (the seed effect's first pass) or right after a
  // brand-new post's first save — which itself immediately navigates from
  // /admin/blog/new to /admin/blog/[id], a different route that remounts
  // this whole component anyway. So this never fires mid-interaction on an
  // already-loaded post; it only ever fires when there's a fresh document to
  // load, exactly when a recreate (reading contentMarkdown fresh) is wanted.
  const composeEditor = useEditor(
    {
      extensions: COMPOSE_EXTENSIONS,
      content: contentMarkdown,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: "prose dark:prose-invert max-w-none min-h-[60vh] py-6 outline-none",
        },
      },
      onUpdate: ({ editor }) => {
        const markdownStorage = editor.storage as unknown as { markdown: MarkdownStorage };
        setContentMarkdown(markdownStorage.markdown.getMarkdown());
        markDirty();
      },
    },
    [mode, loadedId],
  );

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

  // Every toolbar action needs two implementations — Compose drives the
  // Tiptap editor's own commands, Markdown edits the raw text directly.
  // Each function below picks the right one for the active mode.
  const applyParagraphStyle = (style: (typeof PARAGRAPH_STYLES)[number]) => {
    if (mode === "compose" && composeEditor) {
      if (style.level === null) composeEditor.chain().focus().setParagraph().run();
      else composeEditor.chain().focus().toggleHeading({ level: style.level }).run();
      return;
    }
    applyLinePrefix(style.prefix);
  };

  const toggleQuote = () => {
    if (mode === "compose" && composeEditor) {
      composeEditor.chain().focus().toggleBlockquote().run();
      return;
    }
    applyLinePrefix("> ");
  };

  const toggleBold = () => {
    if (mode === "compose" && composeEditor) {
      composeEditor.chain().focus().toggleBold().run();
      return;
    }
    wrapSelection("**", "**", "bold text");
  };

  const toggleItalic = () => {
    if (mode === "compose" && composeEditor) {
      composeEditor.chain().focus().toggleItalic().run();
      return;
    }
    wrapSelection("*", "*", "italic text");
  };

  const insertLink = () => {
    if (mode === "compose" && composeEditor) {
      const url = window.prompt("Link URL", "https://");
      if (!url) return;
      composeEditor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      return;
    }
    wrapSelection("[", "](https://)", "link text");
  };

  const toggleBulletList = () => {
    if (mode === "compose" && composeEditor) {
      composeEditor.chain().focus().toggleBulletList().run();
      return;
    }
    applyLinePrefix("- ");
  };

  const toggleOrderedList = () => {
    if (mode === "compose" && composeEditor) {
      composeEditor.chain().focus().toggleOrderedList().run();
      return;
    }
    applyLinePrefix("1. ");
  };

  // The blog chat panel's tools mutate the post through these — the exact
  // same setters manual typing uses (including the title→slug auto-sync and
  // Compose's own doc needing a separate push, same as html-mode typing
  // does above), so an AI edit flows through the identical dirty/autosave
  // path a manual edit does. Never a direct DB write.
  const blogEditorActions: BlogEditorActions = {
    setContent: (next) => {
      setContentMarkdown(next);
      if (mode === "compose") composeEditor?.commands.setContent(next);
      markDirty();
    },
    setExcerpt: (next) => {
      setExcerpt(next);
      markDirty();
    },
    setTags: (next) => {
      setTags(next);
      markDirty();
    },
    setTitle: (next) => {
      setTitle(next);
      if (!slugTouched) setSlug(slugify(next));
      markDirty();
    },
  };

  // Snapshotted fresh on every chat turn — what the agent sees of the post
  // right now, folded into its next message (see useBlogAiChat).
  const getPostState = () => ({ contentMarkdown, excerpt, published, tags, title });

  // Before the first save there's no real post id for chat threads to
  // attach to, and this component remounts on that first save (see the
  // autosave effect's own comment below) — so the panel only ever mounts
  // once a real id exists, from whichever of these two sources has it first.
  const chatPostId = post?.id ?? (createdOnce ? loadedId : null);

  // Title and slug both get a fallback in save() below when empty, so all
  // that's actually required to start saving is some body content.
  const valid = Boolean(contentMarkdown.trim());
  const pending = create.isPending || update.isPending;
  // True once we know for sure the post is gone (an id in the URL, the list
  // loaded, and it's just not in there) — distinct from "hasn't loaded yet."
  // Blocks autosave the same way the 404 handler below does, in case the
  // post vanishes from the cache some other way than that specific request
  // failing (e.g. a background refetch after it was deleted elsewhere).
  const knownMissing = Boolean(postId && !posts.isLoading && !post);
  // Whether the post is live right now, per the server — not the sidebar
  // switch, which the user can flip without having saved yet. Once a post
  // is live, edits (including flipping that switch back off) stop
  // autosaving; the top-bar button becomes "Update" and is the only thing
  // that pushes changes, so an in-progress edit never appears on the public
  // page before the author means it to.
  const isLive = Boolean(post?.published);

  // Forces published: true only for the initial "Publish" action (post not
  // live yet) — its label promises that. Once live, the button reads
  // "Update" and just saves whatever the form currently holds, so toggling
  // the Published switch off and clicking Update actually unpublishes
  // instead of being silently forced back on. Passed as an override instead
  // of going through setPublished() first, since that state update wouldn't
  // be visible in this same synchronous call's closure yet.
  const save = (overrides?: { published?: boolean }, options?: { viaButton?: boolean }) => {
    if (!valid || savingRef.current) return;
    savingRef.current = true;
    if (options?.viaButton) setPublishPending(true);
    setError(null);

    // Captured now, before the request goes out — this is the version of
    // local state this specific payload represents, independent of whatever
    // editVersionRef climbs to while the request is in flight.
    const versionAtSend = editVersionRef.current;
    const nextPublished = overrides?.published ?? published;
    // Title and slug can both be genuinely empty here — a draft with only
    // body content still needs something to save. The Title field itself
    // stays empty (placeholder keeps showing); the slug fallback is stored
    // back via setSlug so the Permalink field reflects what's actually
    // saved, and so it stays the SAME slug on every autosave tick instead of
    // a fresh random one each time.
    const effectiveTitle = title.trim() || FALLBACK_TITLE;
    let effectiveSlug = slug.trim();
    if (!effectiveSlug) {
      effectiveSlug = fallbackSlug(contentMarkdown);
      setSlug(effectiveSlug);
    }
    const input = {
      authorName: authorName.trim() || undefined,
      contentMarkdown: contentMarkdown.trim(),
      excerpt: excerpt.trim() || undefined,
      published: nextPublished,
      slug: effectiveSlug,
      tags,
      title: effectiveTitle,
    };
    if (nextPublished !== published) setPublished(nextPublished);

    const onSettled = () => {
      savingRef.current = false;
      setPublishPending(false);
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
          onError: (e) => {
            // The row is gone server-side — another tab/session deleted it.
            // Retrying can never succeed, so stop autosaving instead of
            // hammering a 404 forever; drop the stale cached post so the
            // "doesn't exist anymore" fallback takes over.
            if (e instanceof ApiError && e.status === 404) {
              setError("This post was deleted elsewhere — your changes here can't be saved.");
              setDirty(false);
              queryClient.invalidateQueries({ queryKey: adminBlogPostsQueryKey });
              onSettled();
              return;
            }
            onError(e);
          },
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

  // Autosaves a valid draft shortly after the last keystroke, so nothing is
  // ever lost waiting for a manual save. Once the post is live, this stops —
  // edits sit as "Unsaved" until the author clicks Update, so a live post
  // never changes on its own mid-edit. A brand-new post's first save
  // navigates from /admin/blog/new to /admin/blog/[id], which remounts this
  // whole component — the chat panel only ever mounts once chatPostId
  // exists (i.e. after that first save), so this firing mid-chat is not a
  // concern the way it was for the old one-shot AI dialog.
  useEffect(() => {
    if (!dirty || !valid || pending || isLive || knownMissing) return;
    const timer = setTimeout(save, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, contentMarkdown, authorName, tags, published, dirty, valid, pending, isLive, knownMissing]);

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
    <div className="flex min-h-0">
    <div className="flex min-w-0 flex-1 flex-col">
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
          disabled={!valid || pending}
          onClick={() => save(isLive ? undefined : { published: true }, { viaButton: true })}
          className="gap-1.5 rounded-full"
        >
          {publishPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          {isLive ? "Update" : "Publish"}
        </Button>
      </div>

      <div className="flex min-w-0 flex-1 gap-6 pt-3">
        {/* Editor column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-[52px] z-10 flex items-center gap-0.5 rounded-xl border bg-muted px-1.5 py-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                title="Editing mode"
                className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[min(var(--radius-md),12px)] px-1.5 text-foreground outline-none select-none hover:bg-muted-foreground/10"
              >
                {mode === "markdown" ? (
                  <CodeXml className="size-3.5" />
                ) : mode === "html" ? (
                  <FileCode className="size-3.5" />
                ) : (
                  <Pencil className="size-3.5" />
                )}
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value={mode}
                  onValueChange={(value) => {
                    const next = value as typeof mode;
                    // HTML view is a plain textarea, not its own live editor —
                    // seed it from the Compose doc's current HTML right as we
                    // switch in, same as Compose itself re-seeds from
                    // contentMarkdown when its own deps change.
                    if (next === "html") setHtmlDraft(composeEditor?.getHTML() ?? "");
                    setMode(next);
                  }}
                >
                  <DropdownMenuRadioItem value="markdown">
                    <CodeXml className="size-3.5" /> Markdown
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="html">
                    <FileCode className="size-3.5" /> HTML
                  </DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="compose">
                    <Pencil className="size-3.5" /> Compose
                  </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="mx-1 h-4 w-px bg-border" />
            <DropdownMenu>
              <DropdownMenuTrigger
                title="Paragraph style"
                className="flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[min(var(--radius-md),12px)] px-2 text-xs font-medium text-foreground outline-none select-none hover:bg-muted-foreground/10"
              >
                Paragraph
                <ChevronDown className="size-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {PARAGRAPH_STYLES.map((style) => (
                  <DropdownMenuItem
                    key={style.label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => applyParagraphStyle(style)}
                  >
                    {style.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <ToolbarButton title="Quote" onClick={toggleQuote}>
              <Quote className="size-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton title="Bold" onClick={toggleBold}>
              <Bold className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Italic" onClick={toggleItalic}>
              <Italic className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Link" onClick={insertLink}>
              <Link2 className="size-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
            <ToolbarButton title="Bullet list" onClick={toggleBulletList}>
              <List className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton title="Numbered list" onClick={toggleOrderedList}>
              <ListOrdered className="size-3.5" />
            </ToolbarButton>
            <div className="flex-1" />
            <ToolbarButton title="Blog AI" onClick={() => setChatPanelOpen((v) => !v)}>
              <Sparkles className="size-3.5" />
            </ToolbarButton>
            <div className="mx-1 h-4 w-px bg-border" />
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

          {mode === "compose" ? (
            <EditorContent editor={composeEditor} />
          ) : mode === "html" ? (
            <div className="min-h-[60vh] py-6">
              <textarea
                value={htmlDraft}
                onChange={(e) => {
                  const html = e.target.value;
                  setHtmlDraft(html);
                  try {
                    composeEditor?.commands.setContent(generateJSON(html, COMPOSE_EXTENSIONS));
                  } catch {
                    // Mid-edit HTML can be momentarily unparseable (an
                    // unclosed tag, etc.) — contentMarkdown just stays at its
                    // last valid value until a keystroke parses cleanly.
                  }
                }}
                placeholder="Write HTML…"
                className="min-h-[60vh] w-full resize-none border-0 bg-transparent font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          ) : (
            <div className="min-h-[60vh] py-6">
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
            </div>
          )}

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

    {chatPanelOpen && (
      chatPostId ? (
        <BlogChatPanel
          postId={chatPostId}
          actions={blogEditorActions}
          getPostState={getPostState}
          onClose={() => setChatPanelOpen(false)}
        />
      ) : (
        <aside className="flex min-h-0 w-[340px] shrink-0 flex-col items-center justify-center gap-3 border-l border-border bg-card p-6 text-center">
          <p className="text-xs text-muted-foreground">Save this post once to start chatting.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setChatPanelOpen(false)}>
            Close
          </Button>
        </aside>
      )
    )}
    </div>
  );
}
