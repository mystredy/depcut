"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Camera,
  Ghost,
  Hash,
  Film,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
  Send,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import {
  OAUTH_CAPABLE_PLATFORMS,
  PUBLISHABLE_PLATFORMS,
  YOUTUBE_PLATFORMS,
} from "@/lib/marketplace/oauth-providers";
import { SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";
import { cn } from "@/lib/utils";
import {
  type AdminSocialConnection,
  type SocialConnectionAnalyticsRow,
  adminSocialConnectionsQueryKey,
  useAdminSocialConnections,
  useCreateSocialConnection,
  useDeleteSocialConnection,
  usePublishSocialVideo,
  useSocialConnectionAnalytics,
  useUpdateSocialConnection,
} from "@/queries/admin";

// lucide-react dropped brand/logo icons — these are generic stand-ins.
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  facebook: MessageCircle,
  instagram: Camera,
  snapchat: Ghost,
  telegram: Send,
  threads: AtSign,
  tiktok: Share2,
  x: Hash,
  youtube: Video,
  youtube_shorts: Film,
};

type Filter = "all" | "source" | "destination" | "inactive";

// Which social accounts are actually linked as a publish source or
// destination — distinct from Settings > OAuth App, which stores each
// platform's own API app credentials that this page's real "Connect" flow
// reads (see /api/admin/oauth/[platform]/start). Telegram has no OAuth
// flow, so it (and any platform without configured app credentials) falls
// back to recording a connection manually.
export default function AdminSocialConnectionsPage() {
  const connections = useAdminSocialConnections();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  // The OAuth popup (see AddConnectionDialog.connectViaOAuth) posts this
  // back once a real connection is saved server-side, so the list picks it
  // up without a manual refresh.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "social-connection-added") {
        queryClient.invalidateQueries({ queryKey: adminSocialConnectionsQueryKey });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient]);

  const all = connections.data?.connections ?? [];
  const filtered = all.filter((c) => {
    if (filter === "source" && c.role !== "source") return false;
    if (filter === "destination" && c.role !== "destination") return false;
    if (filter === "inactive" && c.status !== "inactive") return false;
    if (search && !`${c.accountName} ${c.accountHandle ?? ""}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Link2 className="size-5 text-muted-foreground" /> Connections
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Social accounts linked as a publish source or destination. Connect via real OAuth
            once a platform&apos;s App ID/Secret are set under Settings → OAuth App, or add one
            manually.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="size-3.5" data-icon="inline-start" /> Add New Connection
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border px-2.5 py-1.5 focus-within:border-ring">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search connections…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Connections</SelectItem>
            <SelectItem value="source">Source</SelectItem>
            <SelectItem value="destination">Destination</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
        If you change the password on a linked social account, its connection may go inactive —
        you&apos;ll need to update it here.
      </p>

      {connections.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : connections.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load connections. Try again.</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No connections yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <ConnectionCard key={c.id} connection={c} />
          ))}
        </div>
      )}

      <AddConnectionDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function ConnectionCard({ connection }: { connection: AdminSocialConnection }) {
  const update = useUpdateSocialConnection();
  const del = useDeleteSocialConnection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [viewingAnalytics, setViewingAnalytics] = useState(false);
  const Icon = PLATFORM_ICONS[connection.platform] ?? Link2;
  const isYoutube = YOUTUBE_PLATFORMS.includes(connection.platform);
  const isPublishable = PUBLISHABLE_PLATFORMS.includes(connection.platform);

  const expiryLabel = connection.tokenExpiresAt
    ? new Date(connection.tokenExpiresAt) < new Date()
      ? "Token expired"
      : `Token expires ${new Date(connection.tokenExpiresAt).toLocaleDateString()}`
    : "No expiration date";

  return (
    <div className="relative flex items-start justify-between gap-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
          {connection.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- external platform avatar, not an optimizable local asset
            <img src={connection.profileImage} alt="" className="size-full object-cover" />
          ) : (
            <Icon className="size-4" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold">{connection.accountName}</p>
            <span
              className={cn(
                "size-2 rounded-full",
                connection.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
              )}
              title={connection.status}
            />
          </div>
          {connection.accountHandle && (
            <p className="text-xs text-muted-foreground">{connection.accountHandle}</p>
          )}
          <p className="mt-1.5 text-xs text-muted-foreground">{expiryLabel}</p>
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border bg-popover p-1 text-xs shadow-md">
            {isPublishable && (
              <button
                type="button"
                onClick={() => {
                  setPosting(true);
                  setMenuOpen(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
              >
                Post video
              </button>
            )}
            {isYoutube && (
              <button
                type="button"
                onClick={() => {
                  setViewingAnalytics(true);
                  setMenuOpen(false);
                }}
                className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
              >
                View analytics
              </button>
            )}
            <button
              type="button"
              disabled={update.isPending}
              onClick={() => {
                update.mutate({ id: connection.id, status: connection.status === "active" ? "inactive" : "active" });
                setMenuOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
            >
              Mark {connection.status === "active" ? "inactive" : "active"}
            </button>
            <button
              type="button"
              disabled={del.isPending}
              onClick={() => {
                del.mutate(connection.id);
                setMenuOpen(false);
              }}
              className="block w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {isPublishable && (
        <PostVideoDialog connection={connection} open={posting} onClose={() => setPosting(false)} />
      )}
      {isYoutube && (
        <AnalyticsDialog connection={connection} open={viewingAnalytics} onClose={() => setViewingAnalytics(false)} />
      )}
    </div>
  );
}

function PostVideoDialog({
  connection,
  open,
  onClose,
}: {
  connection: AdminSocialConnection;
  open: boolean;
  onClose: () => void;
}) {
  const publish = usePublishSocialVideo();
  const [videoUrl, setVideoUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] = useState<"public" | "unlisted" | "private">("unlisted");

  const isYoutubePlatform = YOUTUBE_PLATFORMS.includes(connection.platform);
  const isTiktok = connection.platform === "tiktok";
  const isX = connection.platform === "x";
  const isCaptionPlatform = isTiktok || connection.platform === "facebook" || connection.platform === "instagram";
  const videoRequired = !isX;

  const close = () => {
    publish.reset();
    setVideoUrl("");
    setTitle("");
    setDescription("");
    setPrivacyStatus("unlisted");
    onClose();
  };

  const submit = () => {
    if ((videoRequired && !videoUrl.trim()) || !title.trim()) return;
    publish.mutate({
      description: description.trim() || undefined,
      id: connection.id,
      privacyStatus,
      title: title.trim(),
      videoUrl: videoUrl.trim() || undefined,
    });
  };

  const published = publish.data?.published;
  const publishedUrl =
    published && "url" in published && typeof published.url === "string" ? published.url : null;
  const publishedId =
    published && "publishId" in published && typeof published.publishId === "string"
      ? published.publishId
      : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Post to {connection.accountName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isTiktok && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              TikTok forces unaudited apps to post private/self-only — this will land as a draft
              visible only to the connected account until TikTok approves the app for public
              posting.
            </p>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">Video URL{isX ? " (optional)" : ""}</Label>
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://…/video.mp4"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              A direct link to the video file — an R2 object or any hosted URL. There&apos;s no
              upload-from-computer path yet.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{isX ? "Post text" : isCaptionPlatform ? "Caption" : "Title"}</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={isX ? 280 : undefined}
              placeholder={isX ? "What's happening?" : isCaptionPlatform ? "Caption" : "Video title"}
            />
          </div>
          {isYoutubePlatform && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Description (optional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Privacy</Label>
                <Select value={privacyStatus} onValueChange={(v) => setPrivacyStatus(v as typeof privacyStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unlisted">Unlisted</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {publish.isError && (
            <p className="text-xs text-destructive">{(publish.error as Error).message}</p>
          )}
          {publish.isSuccess && publishedUrl && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Published:{" "}
              <a href={publishedUrl} target="_blank" rel="noreferrer" className="underline">
                {publishedUrl}
              </a>
            </p>
          )}
          {publish.isSuccess && !publishedUrl && publishedId && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              Submitted — publish ID {publishedId}. Check the connected account&apos;s TikTok app to
              see it.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {publish.isSuccess ? "Close" : "Cancel"}
          </Button>
          {!publish.isSuccess && (
            <Button
              disabled={(videoRequired && !videoUrl.trim()) || !title.trim() || publish.isPending}
              onClick={submit}
            >
              {publish.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Post
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AnalyticsTotalKey = Exclude<keyof SocialConnectionAnalyticsRow, "day">;

const ANALYTICS_METRICS: { key: AnalyticsTotalKey; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "estimatedMinutesWatched", label: "Minutes watched" },
  { key: "likes", label: "Likes" },
  { key: "subscribersGained", label: "Subscribers gained" },
];

function AnalyticsDialog({
  connection,
  open,
  onClose,
}: {
  connection: AdminSocialConnection;
  open: boolean;
  onClose: () => void;
}) {
  const analytics = useSocialConnectionAnalytics();

  useEffect(() => {
    if (open) analytics.mutate({ days: 28, id: connection.id });
    // Re-fetch fresh each time the dialog opens; not on every analytics identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, connection.id]);

  const totals = analytics.data?.rows.reduce(
    (acc, row) => {
      for (const { key } of ANALYTICS_METRICS) acc[key] += row[key];
      return acc;
    },
    { estimatedMinutesWatched: 0, likes: 0, subscribersGained: 0, views: 0 }
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{connection.accountName} — last 28 days</DialogTitle>
        </DialogHeader>
        {analytics.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : analytics.isError ? (
          <p className="text-sm text-destructive">{(analytics.error as Error).message}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {ANALYTICS_METRICS.map(({ key, label }) => (
              <div key={key} className="rounded-xl border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-semibold">{(totals?.[key] ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddConnectionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateSocialConnection();
  const [platform, setPlatform] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [accountHandle, setAccountHandle] = useState("");

  const reset = () => {
    setPlatform(null);
    setAccountName("");
    setAccountHandle("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!platform || !accountName.trim()) return;
    create.mutate(
      { accountHandle: accountHandle.trim() || undefined, accountName: accountName.trim(), platform },
      { onSuccess: close }
    );
  };

  const connectViaOAuth = () => {
    if (!platform || !accountName.trim()) return;
    const params = new URLSearchParams({ name: accountName.trim() });
    window.open(`/api/admin/oauth/${platform}/start?${params}`, "oauth-connect", "width=520,height=680");
    close();
  };

  const spec = platform ? SOCIAL_APP_SEED.find((s) => s.platform === platform) : null;
  const isOAuthCapable = platform ? OAUTH_CAPABLE_PLATFORMS.includes(platform) : false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className={spec ? undefined : "sm:max-w-lg"}>
        <DialogHeader>
          <DialogTitle>{spec ? "Add New Connection" : "Add a new connection"}</DialogTitle>
          {!spec && (
            <p className="text-xs text-muted-foreground">
              Select a platform to use as your source or destination.
            </p>
          )}
        </DialogHeader>

        {!spec ? (
          <div className="grid grid-cols-2 gap-2.5">
            {SOCIAL_APP_SEED.filter((s) => OAUTH_CAPABLE_PLATFORMS.includes(s.platform)).map((s) => {
              const Icon = PLATFORM_ICONS[s.platform] ?? Link2;
              return (
                <button
                  key={s.platform}
                  type="button"
                  onClick={() => setPlatform(s.platform)}
                  className="flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">Source / Destination</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPlatform(null)}
              className="text-xs text-primary hover:underline"
            >
              ← Change platform
            </button>
            <div className="space-y-1.5">
              <Label className="text-xs">Platform</Label>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-sm">
                <PlatformIcon platform={spec.platform} className="size-4" />
                {spec.label}
              </div>
            </div>

            {isOAuthCapable ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Name this Connection</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder={spec.label}
                    autoFocus
                  />
                </div>
                <div className="pt-1">
                  <Button className="w-full" disabled={!accountName.trim()} onClick={connectViaOAuth}>
                    Connect via {spec.label}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account name</Label>
                  <Input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. Virals Telegram"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Handle (optional)</Label>
                  <Input
                    value={accountHandle}
                    onChange={(e) => setAccountHandle(e.target.value)}
                    placeholder="@handle"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {spec && !isOAuthCapable && (
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={!accountName.trim() || create.isPending} onClick={submit}>
              {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Add Connection
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const Icon = PLATFORM_ICONS[platform] ?? Link2;
  return <Icon className={className} />;
}
