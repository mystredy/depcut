"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, EllipsisVertical, Link2, Pencil, Play, Plus, Trash2, Video, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DropDialog } from "@/cut/components/DropDialog";
import { ImageCropDialog } from "@/cut/components/ImageCropDialog";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";
import {
  studioAvatarUrl,
  studioBackgroundUrl,
  useRemoveStudioAvatar,
  useRemoveStudioBackground,
  useRemoveStudioDrop,
  useStudioByUsername,
  useStudioDrops,
  useUpdateStudio,
  useUpdateStudioAvatar,
  useUpdateStudioBackground,
} from "@/queries/studio";

// A studio's public profile — avatar, bio, drops grid — plus edit/manage
// entry points for whoever runs it.
export default function StudioPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const base = useCutBase();
  const router = useRouter();
  const { data, isLoading } = useStudioByUsername(username);
  const drops = useStudioDrops(data?.studio.id ?? "");
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingBackground, setEditingBackground] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [dropMenuOpenId, setDropMenuOpenId] = useState<string | null>(null);

  const studioId = data?.studio.id ?? "";
  const update = useUpdateStudio(studioId);
  const updateAvatar = useUpdateStudioAvatar(studioId);
  const removeAvatar = useRemoveStudioAvatar(studioId);
  const updateBackground = useUpdateStudioBackground(studioId);
  const removeBackground = useRemoveStudioBackground(studioId);
  const removeDrop = useRemoveStudioDrop(studioId);

  const startEditName = () => {
    setNameDraft(data?.studio.name ?? "");
    setEditingName(true);
  };
  const saveName = () => {
    const value = nameDraft.trim();
    if (!value) return;
    update.mutate({ name: value }, { onSuccess: () => setEditingName(false) });
  };
  const startEditUsername = () => {
    setUsernameDraft(data?.studio.username ?? "");
    setEditingUsername(true);
  };
  const saveUsername = () => {
    const value = usernameDraft.trim().toLowerCase();
    if (!value) return;
    update.mutate(
      { username: value },
      {
        onSuccess: () => {
          setEditingUsername(false);
          router.replace(`/@${value}`);
        },
      },
    );
  };

  const copyLink = async () => {
    try {
      const url = data
        ? `${window.location.origin}/@${data.studio.username}`
        : window.location.href;
      await navigator.clipboard.writeText(url);
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
        {studioBackgroundUrl(studio) && (
          // eslint-disable-next-line @next/next/no-img-element -- own R2-backed route, not an optimizable remote image
          <img src={studioBackgroundUrl(studio)!} alt="" className="size-full object-cover" />
        )}
        {isManager && (
          <>
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <button
                type="button"
                aria-label={editMode ? "Done editing" : "Edit studio"}
                title={editMode ? "Done editing" : "Edit studio"}
                onClick={() => setEditMode((v) => !v)}
                className={cn(
                  "grid size-8 place-items-center rounded-full backdrop-blur transition-colors",
                  editMode
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/80 text-foreground hover:bg-background"
                )}
              >
                <Pencil className="size-3.5" />
              </button>
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
                  <DropdownMenuItem onClick={() => router.push(`${base}/studio/${studio.username}/settings`)}>
                    <Pencil className="size-3.5" />
                    Studio settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {editMode && (
              <button
                type="button"
                aria-label="Edit background image"
                title="Edit background image"
                onClick={() => setEditingBackground(true)}
                className="absolute bottom-3 right-3 grid size-8 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
              >
                <Camera className="size-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      <div className="mx-auto flex max-w-2xl flex-col items-center px-6 text-center">
        <div className="relative -mt-10">
          <UserAvatar
            name={studio.name}
            image={studioAvatarUrl(studio)}
            className="size-20 rounded-full text-2xl ring-4 ring-primary ring-offset-4 ring-offset-background"
          />
          {isManager && editMode && (
            <button
              type="button"
              aria-label="Edit avatar"
              title="Edit avatar"
              onClick={() => setEditingAvatar(true)}
              className="absolute -right-1 bottom-1 grid size-6 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border hover:text-foreground"
            >
              <Camera className="size-3" />
            </button>
          )}
        </div>

        {editingName ? (
          <div className="mt-3 flex items-center gap-1.5">
            <Input
              autoFocus
              className="h-8 max-w-[220px] text-center"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
            <button
              type="button"
              aria-label="Save name"
              onClick={saveName}
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => setEditingName(false)}
              className="grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5">
            <h1 className="text-lg font-semibold tracking-tight">{studio.name}</h1>
            {isManager && editMode && (
              <button
                type="button"
                aria-label="Edit studio name"
                onClick={startEditName}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )}

        {editingUsername ? (
          <div className="mt-0.5 flex items-center gap-1.5">
            <Input
              autoFocus
              className="h-7 max-w-[180px] text-center text-[13px]"
              value={usernameDraft}
              onChange={(e) => setUsernameDraft(e.target.value.toLowerCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveUsername();
                if (e.key === "Escape") setEditingUsername(false);
              }}
            />
            <button
              type="button"
              aria-label="Save username"
              onClick={saveUsername}
              className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Check className="size-3" />
            </button>
            <button
              type="button"
              aria-label="Cancel"
              onClick={() => setEditingUsername(false)}
              className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
            <span>@{studio.username}</span>
            {isManager && editMode && (
              <button
                type="button"
                aria-label="Edit username"
                onClick={startEditUsername}
                className="text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3" />
              </button>
            )}
            <span>
              · {studio.spaceType}
              {studio.showFollowerCount && <> · 0 followers</>}
            </span>
          </p>
        )}

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
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
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
                {isManager && (
                  <DropdownMenu
                    open={dropMenuOpenId === drop.id}
                    onOpenChange={(open) => setDropMenuOpenId(open ? drop.id : null)}
                  >
                    <DropdownMenuTrigger
                      aria-label="Drop actions"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="pointer-events-auto absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
                    >
                      <EllipsisVertical className="size-3.5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="min-w-0 w-auto p-0.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={removeDrop.isPending}
                        className="px-2 py-1 text-xs"
                        onClick={() => removeDrop.mutate(drop.id)}
                      >
                        <Trash2 className="size-3" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
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
                  {drop.status === "uploading"
                    ? "Uploading…"
                    : drop.title || drop.caption || drop.fileName || "Untitled"}
                </p>
                {drop.hashtags.length > 0 && (
                  <p className="relative truncate text-[10px] text-muted-foreground">
                    {drop.hashtags.map((t) => `#${t}`).join(" ")}
                  </p>
                )}
              </a>
            ))}
          </div>
        )}
      </div>

      {posting && <DropDialog projectId={null} studioId={studio.id} onClose={() => setPosting(false)} />}

      <ImageCropDialog
        open={editingAvatar}
        onOpenChange={setEditingAvatar}
        title="Studio avatar"
        aspectClassName="aspect-square"
        outputWidth={256}
        outputHeight={256}
        hasCustomImage={studio.avatarImageKey !== null}
        onSave={(image) => updateAvatar.mutateAsync(image).then(() => {})}
        onRemove={() => removeAvatar.mutateAsync().then(() => {})}
      />
      <ImageCropDialog
        open={editingBackground}
        onOpenChange={setEditingBackground}
        title="Studio background"
        aspectClassName="aspect-[3/1]"
        outputWidth={1200}
        outputHeight={400}
        hasCustomImage={studio.backgroundImageKey !== null}
        onSave={(image) => updateBackground.mutateAsync(image).then(() => {})}
        onRemove={() => removeBackground.mutateAsync().then(() => {})}
      />
    </div>
  );
}
