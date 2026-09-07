"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Heart, Pencil, Play, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/cut/components/desktopFolders";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { useCutBase } from "@/cut/lib/nav";
import { useAccountProfile, visibleName } from "@/queries/accountProfile";
import { useSpacePosts } from "@/queries/space";
import { cn } from "@/lib/utils";

type Tab = "posts" | "likes";

// A personal space for each account: who you are, and what you've posted
// (from the editor's Post to Space action — see PostToSpaceDialog) plus
// likes, once liking exists. No followers/following graph, no Subscribe
// banner, no Tasks/Invite/Events — those either belong to billing/settings
// already, or don't exist yet. Bio isn't here yet either: there's no column
// for it on User, only what settings/profile already edits for real
// (display name, avatar, username).
export default function SpacePage() {
  const base = useCutBase();
  const { data: session } = authClient.useSession();
  const { data: profile } = useAccountProfile();
  const posts = useSpacePosts();
  const [tab, setTab] = useState<Tab>("posts");
  const [copied, setCopied] = useState(false);

  // The layout's SettingsGuard redirects a signed-out visitor before this
  // ever renders; this null render is only the one frame before that fires.
  if (!session) return null;

  const name = visibleName(profile, session.user.name);
  const image = profile?.image ?? session.user.image ?? null;
  const handle = profile?.username ? `@${profile.username}` : null;

  const copyHandle = () => {
    if (!handle) return;
    void navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const visiblePosts = (posts.data?.posts ?? []).filter((p) => p.status !== "error");
  const usedBytes = posts.data?.usedBytes ?? 0;
  const limitBytes = posts.data?.limitBytes ?? 10 * 1024 ** 3;

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex flex-col items-center pt-4 text-center">
        <UserAvatar name={name} image={image} className="size-20 rounded-2xl text-2xl" />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">{name}</h1>
        {handle ? (
          <button
            type="button"
            onClick={copyHandle}
            className="mt-1 flex shrink-0 items-center gap-1 rounded-full border border-input px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? "Copied" : handle}
          </button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-1 h-6 text-[11px]"
            nativeButton={false}
            render={<Link href={`${base}/settings/profile`} />}
          >
            <Pencil data-icon="inline-start" className="size-3" />
            Set a username
          </Button>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">
          {formatBytes(usedBytes)} of {formatBytes(limitBytes)} used
        </p>
        <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, (usedBytes / limitBytes) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex justify-center gap-1 border-b border-border">
        {(
          [
            { key: "posts", label: "Posts" },
            { key: "likes", label: "Likes" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.key
                ? "border-ink text-ink"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "posts" ? (
        visiblePosts.length === 0 ? (
          <div className="grid min-h-[40vh] place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                <Video className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No posts yet.</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Open a project in the editor and use Post to Space to put a finished export here.
              </p>
              <Button nativeButton={false} render={<Link href={`${base}/projects`} />}>
                Open a project
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visiblePosts.map((post) => (
              <a
                key={post.id}
                href={post.status === "complete" ? `/api/space/posts/${post.id}/video` : undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "group relative flex aspect-video flex-col justify-end overflow-hidden rounded-xl border bg-muted p-2",
                  post.status !== "complete" && "pointer-events-none opacity-60"
                )}
              >
                {post.status === "complete" && (
                  <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="grid size-9 place-items-center rounded-full bg-white/95">
                      <Play className="ml-0.5 size-4 fill-ink text-ink" />
                    </span>
                  </span>
                )}
                <p className="truncate text-[11px] font-medium text-foreground">
                  {post.status === "uploading" ? "Uploading…" : post.caption || post.fileName || "Untitled"}
                </p>
                {post.sizeBytes != null && (
                  <p className="text-[10px] text-muted-foreground">{formatBytes(post.sizeBytes)}</p>
                )}
              </a>
            ))}
          </div>
        )
      ) : (
        <div className="grid min-h-[40vh] place-items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-muted">
              <Heart className="size-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No likes yet.</p>
          </div>
        </div>
      )}
    </div>
  );
}
