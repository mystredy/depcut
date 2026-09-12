"use client";

import { use, useState } from "react";
import Link from "next/link";
import { Play, Settings, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StudioSwitcher } from "@/cut/components/StudioSwitcher";
import { PostToSpaceDialog } from "@/cut/components/PostToSpaceDialog";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { formatBytes } from "@/cut/components/desktopFolders";
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";
import { useStudioByUsername, useStudioPosts } from "@/queries/studio";

// A Studio's public profile — same shape as My Space (avatar, bio,
// posts grid), plus a Settings entry point for whoever manages it. No
// avatar/background image upload yet (Studio.avatarImageKey stays
// null until that's built) — UserAvatar's initial-letter fallback covers
// it in the meantime.
export default function StudioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const base = useCutBase();
  const { data, isLoading } = useStudioByUsername(username);
  const posts = useStudioPosts(data?.space.id ?? "");
  const [posting, setPosting] = useState(false);

  if (isLoading) return null;
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted-foreground">
        This space doesn&apos;t exist.
      </div>
    );
  }

  const { space } = data;
  const isManager = space.role != null;
  const visiblePosts = (posts.data?.posts ?? []).filter((p) => p.status !== "error");

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="px-6 pt-4">
        <StudioSwitcher currentUsername={space.username} />
      </div>

      <div className="relative h-32 w-full overflow-hidden rounded-b-2xl bg-muted sm:h-40" />

      <div className="flex flex-col items-center px-6 text-center">
        <UserAvatar
          name={space.name}
          image={null}
          className="-mt-10 size-20 rounded-full text-2xl ring-4 ring-primary ring-offset-4 ring-offset-background"
        />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">{space.name}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          @{space.username} · {space.spaceType}
        </p>

        {space.bio && <p className="mt-3 max-w-sm text-sm text-foreground/90">{space.bio}</p>}

        {isManager && (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            nativeButton={false}
            render={<Link href={`${base}/space/brand/${space.username}/settings`} />}
          >
            <Settings data-icon="inline-start" className="size-3.5" />
            Settings
          </Button>
        )}
      </div>

      <div className="px-6 pt-6">
        {visiblePosts.length === 0 ? (
          <div className="grid min-h-[30vh] place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                <Video className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No posts yet.</p>
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
        )}
      </div>

      {isManager && (
        <button
          type="button"
          onClick={() => setPosting(true)}
          className="fixed bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          Post
        </button>
      )}

      {posting && <PostToSpaceDialog projectId={null} studioId={space.id} onClose={() => setPosting(false)} />}
    </div>
  );
}
