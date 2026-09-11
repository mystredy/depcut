"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, Pencil, Play, Plus, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/cut/components/desktopFolders";
import { PostToSpaceDialog } from "@/cut/components/PostToSpaceDialog";
import { BrandSpaceSwitcher } from "@/cut/components/BrandSpaceSwitcher";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { authClient } from "@/lib/auth-client";
import { useCutBase } from "@/cut/lib/nav";
import { useAccountProfile, visibleName } from "@/queries/accountProfile";
import { useSpacePosts } from "@/queries/space";
import { cn } from "@/lib/utils";

type Tab = "posts" | "likes";

// A personal space for each account: who you are, and what you've posted
// (from the editor's Post to Space action, or the floating Post button
// below) plus likes, once liking exists. No followers/following graph yet —
// showFollowerCount just controls whether a (currently always zero) count
// renders, ahead of that feature existing. No Subscribe banner, no Tasks/
// Invite/Events — those either belong to billing/settings already, or don't
// exist yet.
export default function SpacePage() {
  const base = useCutBase();
  const { data: session } = authClient.useSession();
  const { data: profile } = useAccountProfile();
  const posts = useSpacePosts();
  const [tab, setTab] = useState<Tab>("posts");
  const [posting, setPosting] = useState(false);

  // The layout's SettingsGuard redirects a signed-out visitor before this
  // ever renders; this null render is only the one frame before that fires.
  if (!session) return null;

  const name = visibleName(profile, session.user.name);
  const image = profile?.image ?? session.user.image ?? null;

  const visiblePosts = (posts.data?.posts ?? []).filter((p) => p.status !== "error");
  const usedBytes = posts.data?.usedBytes ?? 0;
  const limitBytes = posts.data?.limitBytes ?? 10 * 1024 ** 3;

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="px-6 pt-4">
        <BrandSpaceSwitcher currentUsername={null} />
      </div>

      <div className="relative h-32 w-full overflow-hidden rounded-b-2xl bg-muted sm:h-40">
        {profile?.backgroundImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.backgroundImage}
            alt=""
            className="size-full object-cover"
          />
        )}
      </div>

      <div className="flex flex-col items-center px-6 text-center">
        <UserAvatar
          name={name}
          image={image}
          className="-mt-10 size-20 rounded-full text-2xl ring-4 ring-primary ring-offset-4 ring-offset-background"
        />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">{name}</h1>

        {profile?.username ? (
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            @{profile.username}
            {profile.showFollowerCount && <> · 0 followers</>}
          </p>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-1.5 h-6 text-[11px]"
            nativeButton={false}
            render={<Link href={`${base}/settings/profile`} />}
          >
            <Pencil data-icon="inline-start" className="size-3" />
            Set a username
          </Button>
        )}

        {profile?.bio && (
          <p className="mt-3 max-w-sm text-sm text-foreground/90">{profile.bio}</p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          nativeButton={false}
          render={<Link href={`${base}/settings/profile`} />}
        >
          Edit Profile
        </Button>

        <p className="mt-4 text-[11px] text-muted-foreground">
          {formatBytes(usedBytes)} of {formatBytes(limitBytes)} used
        </p>
        <div className="mt-1 h-1 w-40 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${Math.min(100, (usedBytes / limitBytes) * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-1 border-b border-border px-6">
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

      <div className="px-6 pt-6">
        {tab === "posts" ? (
          visiblePosts.length === 0 ? (
            <div className="grid min-h-[30vh] place-items-center">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                  <Video className="size-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No posts yet.</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Use the Post button below, or Post to Space from the editor's export bar.
                </p>
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
                    "group relative flex aspect-[9/16] flex-col justify-end overflow-hidden rounded-xl border bg-muted p-2",
                    post.status !== "complete" && "pointer-events-none opacity-60"
                  )}
                >
                  {post.status === "complete" && (
                    <>
                      <video
                        src={`/api/space/posts/${post.id}/video`}
                        muted
                        playsInline
                        preload="metadata"
                        // A loaded <video> doesn't paint its first frame until
                        // something moves currentTime — a fixed nudge is enough
                        // to make the browser render it as a thumbnail.
                        onLoadedMetadata={(e) => {
                          e.currentTarget.currentTime = 0.1;
                        }}
                        className="absolute inset-0 size-full object-cover"
                      />
                      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />
                      <span className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
                        <span className="grid size-9 place-items-center rounded-full bg-white/95">
                          <Play className="ml-0.5 size-4 fill-ink text-ink" />
                        </span>
                      </span>
                    </>
                  )}
                  <p className="relative truncate text-[11px] font-medium text-foreground">
                    {post.status === "uploading" ? "Uploading…" : post.caption || post.fileName || "Untitled"}
                  </p>
                  {post.sizeBytes != null && (
                    <p className="relative text-[10px] text-muted-foreground">{formatBytes(post.sizeBytes)}</p>
                  )}
                </a>
              ))}
            </div>
          )
        ) : (
          <div className="grid min-h-[30vh] place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                <Heart className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No likes yet.</p>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setPosting(true)}
        className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        <Plus className="size-4" />
        Post
      </button>

      {posting && <PostToSpaceDialog projectId={null} onClose={() => setPosting(false)} />}
    </div>
  );
}
