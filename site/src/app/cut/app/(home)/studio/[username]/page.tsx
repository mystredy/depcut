"use client";

import { use, useState } from "react";
import Link from "next/link";
import { EllipsisVertical, Link2, Pencil, Play, Plus, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DropDialog } from "@/cut/components/DropDialog";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { formatBytes } from "@/cut/components/desktopFolders";
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";
import { useStudioByUsername, useStudioDrops } from "@/queries/studio";

// A studio's public profile — avatar, bio, drops grid — plus edit/manage
// entry points for whoever runs it. No avatar/background image upload yet
// (Studio.avatarImageKey stays null until that's built) — UserAvatar's
// initial-letter fallback covers it in the meantime.
export default function StudioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const base = useCutBase();
  const { data, isLoading } = useStudioByUsername(username);
  const drops = useStudioDrops(data?.studio.id ?? "");
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser — nothing further to
      // do here.
    }
  };

  if (isLoading) return null;
  if (!data) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted-foreground">
        This studio doesn&apos;t exist.
      </div>
    );
  }

  const { studio } = data;
  const isManager = studio.role != null;
  const visibleDrops = (drops.data?.drops ?? []).filter((d) => d.status !== "error");

  return (
    <div className="pb-24">
      <div className="relative h-32 w-full overflow-hidden rounded-b-2xl bg-muted sm:h-40">
        {isManager && (
          <div className="absolute right-3 top-3 flex items-center gap-2">
            <Link
              href={`${base}/studio/${studio.username}/settings`}
              aria-label="Edit studio"
              title="Edit studio"
              className="grid size-8 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
            >
              <Pencil className="size-3.5" />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More actions"
                title="More actions"
                className="grid size-8 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
              >
                <EllipsisVertical className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void copyLink()}>
                  <Link2 className="size-3.5" />
                  {copied ? "Copied!" : "Copy studio link"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <UserAvatar
          name={studio.name}
          image={null}
          className="-mt-10 size-20 rounded-full text-2xl ring-4 ring-primary ring-offset-4 ring-offset-background"
        />
        <h1 className="mt-3 text-lg font-semibold tracking-tight">{studio.name}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          @{studio.username} · {studio.spaceType}
          {studio.showFollowerCount && <> · 0 followers</>}
        </p>

        {studio.bio && <p className="mt-3 max-w-sm text-sm text-foreground/90">{studio.bio}</p>}

        {isManager && (
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={() => setPosting(true)}>
              <Plus data-icon="inline-start" className="size-3.5" />
              Add drop
            </Button>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href={`${base}/studio/${studio.username}/settings`} />}
            >
              <Pencil data-icon="inline-start" className="size-3.5" />
              Edit studio
            </Button>
          </div>
        )}
      </div>

      <div className="px-6 pt-6">
        {visibleDrops.length === 0 ? (
          <div className="grid min-h-[30vh] place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="grid size-14 place-items-center rounded-2xl bg-muted">
                <Video className="size-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No drops yet.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {visibleDrops.map((drop) => (
              <a
                key={drop.id}
                href={drop.status === "complete" ? `/api/drops/${drop.id}/video` : undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  "group relative flex aspect-[9/16] flex-col justify-end overflow-hidden rounded-xl border bg-muted p-2",
                  drop.status !== "complete" && "pointer-events-none opacity-60"
                )}
              >
                {drop.status === "complete" && (
                  <>
                    <video
                      src={`/api/drops/${drop.id}/video`}
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
                  {drop.status === "uploading" ? "Uploading…" : drop.caption || drop.fileName || "Untitled"}
                </p>
                {drop.sizeBytes != null && (
                  <p className="relative text-[10px] text-muted-foreground">{formatBytes(drop.sizeBytes)}</p>
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
          <Plus className="size-4" />
          Drop
        </button>
      )}

      {posting && <DropDialog projectId={null} studioId={studio.id} onClose={() => setPosting(false)} />}
    </div>
  );
}
