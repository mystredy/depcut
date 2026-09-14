"use client";

import { use, useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Camera,
  CircleCheck,
  CircleX,
  Ghost,
  Info,
  Link2,
  Loader2,
  MoreVertical,
  Plus,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropDialog } from "@/cut/components/ImageCropDialog";
import { UserAvatar } from "@/cut/components/UserAvatar";
import { OAUTH_CAPABLE_PLATFORMS, PUBLISHABLE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";
import { cn } from "@/lib/utils";
import {
  useStudioActivity,
  useStudioByUsername,
  useStudioConnections,
  useStudioInvites,
  useStudioMembers,
  useStudioWorkflows,
  useCreateStudioWorkflow,
  useDeleteStudio,
  useDeleteStudioWorkflow,
  useDisconnectStudioConnection,
  useRemoveStudioAvatar,
  useRemoveStudioBackground,
  useRemoveStudioMember,
  useRenameStudioConnection,
  useRequestStudioDeleteCode,
  useRequestStudioInviteCode,
  useRevokeStudioInvite,
  useSendStudioInvite,
  useUpdateStudio,
  useUpdateStudioAvatar,
  useUpdateStudioBackground,
  useUpdateStudioWorkflow,
  studioAvatarUrl,
  studioBackgroundUrl,
  studioConnectionsQueryKey,
  type StudioConnection,
  type StudioWorkflow,
} from "@/queries/studio";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/queries/apiClient";

// Real per-platform brand marks for the connection cards and picker, each a
// self-contained rounded-square badge (background + glyph) sized entirely by
// the className passed in — a caller just renders <Icon className="size-8" />
// with no extra wrapper. Facebook/Instagram/X/TikTok/YouTube get a drawn
// glyph; Threads/Snapchat/Telegram reuse their closest Lucide stand-in on the
// platform's real brand color, since their marks aren't simple shapes.
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#1877F2" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="14" fontWeight="700" fontStyle="italic" fill="#fff">
        f
      </text>
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
        X
      </text>
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <polygon points="9.5,7.5 9.5,16.5 17,12" fill="#fff" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#000" />
      <circle cx="10" cy="16" r="2.3" fill="#fff" />
      <rect x="12" y="5" width="1.8" height="11" fill="#fff" />
      <path d="M13.8 5c.3 2 1.8 3.4 3.7 3.6v2c-1.4-.1-2.7-.6-3.7-1.4V5Z" fill="#fff" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="ig-badge-grad" x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#feda75" />
          <stop offset="25%" stopColor="#fa7e1e" />
          <stop offset="50%" stopColor="#d62976" />
          <stop offset="75%" stopColor="#962fbf" />
          <stop offset="100%" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#ig-badge-grad)" />
      <rect x="6.5" y="6.5" width="11" height="11" rx="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="15.7" cy="8.3" r="1" fill="#fff" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-black", className)}>
      <AtSign className="size-[60%] text-white" />
    </div>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#FFFC00]", className)}>
      <Ghost className="size-[60%] text-black" />
    </div>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-[25%] bg-[#26A5E4]", className)}>
      <Send className="size-[55%] text-white" />
    </div>
  );
}

const PLATFORM_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  facebook: FacebookIcon,
  instagram: InstagramIcon,
  snapchat: SnapchatIcon,
  telegram: TelegramIcon,
  threads: ThreadsIcon,
  tiktok: TikTokIcon,
  x: XIcon,
  youtube: YouTubeIcon,
};

// A connection is only good for posting if its token is set, active, and
// (when the platform gave one) not past its expiry — the token itself never
// reaches the client, so this is read off what the API already tells us.
function connectionHealth(c: StudioConnection): { ok: boolean; label: string } {
  if (!c.hasToken || c.status !== "active") {
    return { label: "Token expired or invalid", ok: false };
  }
  const days = c.tokenExpiresAt
    ? Math.ceil((new Date(c.tokenExpiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;
  // A refresh token means an expired access token is routine, not a
  // problem — the platform issues a fresh one silently on next use, so
  // it's never shown as an error. Access tokens are usually short-lived
  // (an hour, for Google), so days is typically already <= 0 here —
  // that's expected, not a sign anything's wrong.
  if (c.hasRefreshToken) {
    return {
      label:
        days !== null && days > 0
          ? `Token expires in ${days} day${days === 1 ? "" : "s"}`
          : "Token refreshes automatically",
      ok: true,
    };
  }
  if (days === null) {
    return { label: "No expiration date", ok: true };
  }
  if (days <= 0) {
    return { label: "Token expired or invalid", ok: false };
  }
  return { label: `Token expires in ${days} day${days === 1 ? "" : "s"}`, ok: true };
}

// Facebook/Instagram OAuth connects the main account, not the destination
// itself — the callback resolves which Page (and, for Instagram, its linked
// Business Account) to post through, auto-picking the only candidate or
// showing a picker for more than one. Told upfront so naming this
// connection after the account, not a specific Page, doesn't read as a bug.
const META_PICKER_NOTES: Record<string, string> = {
  facebook: "This is your main Facebook account. You can choose a Page to publish from when you create a workflow later.",
  instagram: "This is your main Facebook account. You can choose the linked Instagram Business Account to publish from when you create a workflow later.",
};

// Content categories, matching the taxonomy platforms like YouTube use for a
// channel's primary topic. "Creator" stays first as the generic default —
// every studio is created with it, and not every studio fits a niche.
const STUDIO_TYPES = [
  "Creator",
  "Music",
  "Gaming",
  "Education",
  "Entertainment",
  "Comedy",
  "News & Politics",
  "Sports",
  "Film & Animation",
  "Science & Technology",
  "Howto & Style",
  "Travel & Events",
  "Autos & Vehicles",
  "Pets & Animals",
  "People & Blogs",
  "Nonprofits & Activism",
];

type Section = "setup" | "access" | "history" | "repurpose";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "setup", label: "Studio setup" },
  { key: "access", label: "Studio access" },
  { key: "history", label: "Management history" },
  { key: "repurpose", label: "Repurpose" },
];

type RepurposeTab = "connections" | "workflow";

const REPURPOSE_TABS: { key: RepurposeTab; label: string }[] = [
  { key: "connections", label: "Connections" },
  { key: "workflow", label: "Workflow" },
];

export default function StudioSettingsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data, isLoading } = useStudioByUsername(username);
  const [section, setSection] = useState<Section>("setup");
  const [repurposeTab, setRepurposeTab] = useState<RepurposeTab>("connections");

  if (isLoading) return null;
  if (!data || !data.studio.role) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center text-sm text-muted-foreground">
        You don&apos;t manage this studio.
      </div>
    );
  }

  const { studio } = data;

  return (
    <div className="mx-auto max-w-2xl px-6 pb-24">
      <Link
        href={`/@${studio.username}`}
        className="mt-4 flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <h1 className="mt-2 text-lg font-semibold tracking-tight">{studio.name} — Settings</h1>

      <div className="mt-4 flex flex-wrap gap-1 border-b border-border">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSection(s.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              section === s.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "repurpose" && (
        <div className="mt-4 flex flex-wrap gap-1 border-b border-border">
          {REPURPOSE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setRepurposeTab(t.key)}
              className={cn(
                "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                repurposeTab === t.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="pt-6">
        {section === "setup" && <SetupSection studioId={studio.id} studio={studio} />}
        {section === "access" && <AccessSection studioId={studio.id} isOwner={studio.role === "owner"} />}
        {section === "history" && <HistorySection studioId={studio.id} />}
        {section === "repurpose" && repurposeTab === "connections" && <ConnectionsSection studioId={studio.id} />}
        {section === "repurpose" && repurposeTab === "workflow" && <WorkflowSection studioId={studio.id} />}
      </div>
    </div>
  );
}

function SetupSection({
  studioId,
  studio,
}: {
  studioId: string;
  studio: {
    id: string;
    name: string;
    username: string;
    bio: string | null;
    spaceType: string;
    showFollowerCount: boolean;
    avatarImageKey: string | null;
    backgroundImageKey: string | null;
    updatedAt: string;
  };
}) {
  const update = useUpdateStudio(studioId);
  const del = useDeleteStudio(studioId);
  const requestDeleteCode = useRequestStudioDeleteCode(studioId);
  const updateAvatar = useUpdateStudioAvatar(studioId);
  const removeAvatar = useRemoveStudioAvatar(studioId);
  const updateBackground = useUpdateStudioBackground(studioId);
  const removeBackground = useRemoveStudioBackground(studioId);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingBackground, setEditingBackground] = useState(false);
  const [name, setName] = useState(studio.name);
  const [username, setUsername] = useState(studio.username);
  const [bio, setBio] = useState(studio.bio ?? "");
  const [spaceType, setSpaceType] = useState(studio.spaceType);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteTelegramCode, setDeleteTelegramCode] = useState("");

  const startDelete = () => {
    setConfirmingDelete(true);
    setDeleteCode("");
    setDeleteTelegramCode("");
    requestDeleteCode.mutate();
  };
  const cancelDelete = () => {
    setConfirmingDelete(false);
    setDeleteCode("");
    setDeleteTelegramCode("");
  };
  const confirmDelete = () => {
    if (!requestDeleteCode.data) return;
    del.mutate(
      {
        challenge: requestDeleteCode.data.challenge,
        code: deleteCode,
        telegramCode: requestDeleteCode.data.telegramRequired ? deleteTelegramCode : undefined,
      },
      { onSuccess: () => (window.location.href = "/app/studio") },
    );
  };

  const dirty =
    name.trim() !== studio.name ||
    username.trim() !== studio.username ||
    bio.trim() !== (studio.bio ?? "") ||
    spaceType !== studio.spaceType;

  const save = () => {
    update.mutate({
      bio: bio.trim() || null,
      name: name.trim(),
      spaceType,
      username: username.trim(),
    });
  };

  return (
    <>
    <div className="max-w-md space-y-5">
      <div className="relative">
        <div className="relative h-28 w-full overflow-hidden rounded-xl bg-muted">
          {studioBackgroundUrl(studio) && (
            // eslint-disable-next-line @next/next/no-img-element -- own R2-backed route, not an optimizable remote image
            <img src={studioBackgroundUrl(studio)!} alt="" className="size-full object-cover" />
          )}
          <button
            type="button"
            aria-label="Edit background image"
            onClick={() => setEditingBackground(true)}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur transition-colors hover:bg-background"
          >
            <Camera className="size-3.5" />
          </button>
        </div>
        <div className="absolute -bottom-6 left-4">
          <button
            type="button"
            aria-label="Edit avatar"
            onClick={() => setEditingAvatar(true)}
            className="group relative block"
          >
            <UserAvatar
              name={studio.name}
              image={studioAvatarUrl(studio)}
              className="size-14 rounded-full text-lg ring-4 ring-background"
            />
            <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
              <Camera className="size-3" />
            </span>
          </button>
        </div>
      </div>

      <div className="space-y-1.5 pt-6">
        <Label className="text-xs">Studio name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Username</Label>
        <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Bio</Label>
        <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={150} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Studio type</Label>
        <Select value={spaceType} onValueChange={(v) => v && setSpaceType(v)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STUDIO_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="text-sm font-medium">Show follower count</p>
          <p className="text-xs text-muted-foreground">Make the follower count public on this studio.</p>
        </div>
        <Switch
          checked={studio.showFollowerCount}
          onCheckedChange={(checked) => update.mutate({ showFollowerCount: checked })}
          aria-label="Show follower count"
        />
      </div>

      {update.isError && <p className="text-xs text-destructive">{(update.error as Error).message}</p>}

      <Button disabled={!dirty || update.isPending} onClick={save}>
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>

      <div className="mt-10 rounded-xl border border-destructive/30 p-4">
        <p className="text-sm font-medium text-destructive">Delete this studio</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Removes the studio, its drops, managers, and connections for everyone. This can&apos;t be undone.
        </p>
        {confirmingDelete ? (
          <div className="mt-3 space-y-2">
            {requestDeleteCode.isPending ? (
              <p className="text-xs text-muted-foreground">Sending a code to your email…</p>
            ) : requestDeleteCode.isError ? (
              <div className="space-y-2">
                <p className="text-xs text-destructive">
                  {requestDeleteCode.error instanceof ApiError
                    ? requestDeleteCode.error.message
                    : "Couldn't send a code."}
                </p>
                <Button size="sm" variant="outline" onClick={() => requestDeleteCode.mutate()}>
                  Try again
                </Button>
              </div>
            ) : (
              <>
                <Label className="text-xs">
                  Enter the code sent to {requestDeleteCode.data?.sentTo ?? "your email"} to confirm.
                </Label>
                <Input
                  autoFocus
                  className="w-28 tracking-widest"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setDeleteCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  value={deleteCode}
                />
                {requestDeleteCode.data?.telegramRequired && (
                  <>
                    <Label className="text-xs">Enter the code sent to your linked Telegram.</Label>
                    <Input
                      className="w-28 tracking-widest"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) => setDeleteTelegramCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="000000"
                      value={deleteTelegramCode}
                    />
                  </>
                )}
              </>
            )}
            {del.isError && (
              <p className="text-xs text-destructive">
                {del.error instanceof ApiError ? del.error.message : "Couldn't delete the studio."}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelDelete}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={
                  !requestDeleteCode.data ||
                  deleteCode.length !== 6 ||
                  (requestDeleteCode.data.telegramRequired && deleteTelegramCode.length !== 6) ||
                  del.isPending
                }
                onClick={confirmDelete}
              >
                {del.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                Confirm delete
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="destructive" size="sm" className="mt-3" onClick={startDelete}>
            Delete studio
          </Button>
        )}
      </div>
    </div>
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
    </>
  );
}

function AccessSection({ studioId, isOwner }: { studioId: string; isOwner: boolean }) {
  const members = useStudioMembers(studioId);
  const invites = useStudioInvites(studioId);
  const removeMember = useRemoveStudioMember(studioId);
  const revokeInvite = useRevokeStudioInvite(studioId);
  const [email, setEmail] = useState("");
  const [inviteTarget, setInviteTarget] = useState<string | null>(null);

  return (
    <div className="max-w-md space-y-8">
      <div>
        <p className="text-sm font-semibold">Managers</p>
        <div className="mt-3 space-y-2">
          {(members.data?.members ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div>
                <p className="text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted-foreground">
                  {m.email} · {m.role}
                </p>
              </div>
              {isOwner && m.role !== "owner" && (
                <button
                  type="button"
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate(m.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold">Invite someone to help manage this studio</p>
        <div className="mt-3 flex gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
            type="email"
          />
          <Button disabled={!email.trim()} onClick={() => setInviteTarget(email.trim())}>
            Invite
          </Button>
        </div>

        {(invites.data?.invites ?? []).length > 0 && (
          <div className="mt-4 space-y-2">
            {invites.data?.invites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <p className="text-sm">{invite.email}</p>
                <button
                  type="button"
                  disabled={revokeInvite.isPending}
                  onClick={() => revokeInvite.mutate(invite.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <InviteManagerDialog
        studioId={studioId}
        email={inviteTarget}
        onClose={() => setInviteTarget(null)}
        onSent={() => setEmail("")}
      />
    </div>
  );
}

// Sending an invite is two steps: a code goes to the inviting manager's own
// email first, and only entering it back here sends the actual invite to
// the target address — see lib/studio/invite-verification.ts.
function InviteManagerDialog({
  studioId,
  email,
  onClose,
  onSent,
}: {
  studioId: string;
  email: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const requestCode = useRequestStudioInviteCode(studioId);
  const sendInvite = useSendStudioInvite(studioId);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [telegramCode, setTelegramCode] = useState("");

  // Resets challenge/code the moment the target email changes (including to
  // null on close), in render rather than an effect — React's documented
  // pattern for adjusting state when a prop changes.
  const [trackedEmail, setTrackedEmail] = useState(email);
  if (email !== trackedEmail) {
    setTrackedEmail(email);
    setChallenge(null);
    setCode("");
    setTelegramCode("");
  }

  useEffect(() => {
    if (!email) return;
    requestCode.mutate(email, { onSuccess: (result) => setChallenge(result.challenge) });
    // Only re-fires when the target email changes, not on every render the
    // mutations themselves cause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const resend = () => {
    if (!email) return;
    setCode("");
    setTelegramCode("");
    requestCode.mutate(email, { onSuccess: (result) => setChallenge(result.challenge) });
  };

  const confirm = () => {
    if (!email || !challenge) return;
    sendInvite.mutate(
      { challenge, code, email, telegramCode: requestCode.data?.telegramRequired ? telegramCode : undefined },
      {
        onSuccess: () => {
          onSent();
          onClose();
        },
      },
    );
  };

  return (
    <Dialog open={email !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm invite</DialogTitle>
          <DialogDescription>
            Enter the code we sent you to invite{" "}
            <span className="font-medium text-foreground">{email}</span> to manage this studio.
          </DialogDescription>
        </DialogHeader>

        {requestCode.isPending && !challenge ? (
          <p className="text-sm text-muted-foreground">Sending a code to your email…</p>
        ) : requestCode.isError ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              {requestCode.error instanceof ApiError ? requestCode.error.message : "Couldn't send a code."}
            </p>
            <Button size="sm" type="button" variant="outline" onClick={resend}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              We emailed a code to {requestCode.data?.sentTo ?? "your email"}.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="invite-code">Code</Label>
              <Input
                autoFocus
                className="w-28 tracking-widest"
                id="invite-code"
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                value={code}
              />
            </div>
            {requestCode.data?.telegramRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="invite-telegram-code">Code sent to your Telegram</Label>
                <Input
                  className="w-28 tracking-widest"
                  id="invite-telegram-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => setTelegramCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  value={telegramCode}
                />
              </div>
            )}
            {sendInvite.isError && (
              <p className="text-sm text-destructive">
                {sendInvite.error instanceof ApiError ? sendInvite.error.message : "Couldn't send the invite."}
              </p>
            )}
            <button
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={resend}
              type="button"
            >
              Resend code
            </button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={
              !challenge ||
              code.length !== 6 ||
              (requestCode.data?.telegramRequired && telegramCode.length !== 6) ||
              sendInvite.isPending
            }
            onClick={confirm}
          >
            {sendInvite.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistorySection({ studioId }: { studioId: string }) {
  const activity = useStudioActivity(studioId);

  return (
    <div className="max-w-md space-y-2">
      <p className="text-sm text-muted-foreground">
        A history of management actions taken by people who manage this studio.
      </p>
      {(activity.data?.activity ?? []).length === 0 ? (
        <p className="pt-4 text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {activity.data?.activity.map((entry) => (
            <div key={entry.id} className="rounded-xl border px-3 py-2">
              <p className="text-sm">
                <span className="font-medium">{entry.actorName}</span> {entry.action.charAt(0).toLowerCase() + entry.action.slice(1)}
              </p>
              <p className="text-[11px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionsSection({ studioId }: { studioId: string }) {
  const connections = useStudioConnections(studioId);
  const disconnect = useDisconnectStudioConnection(studioId);
  const rename = useRenameStudioConnection(studioId);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showConnectOptions, setShowConnectOptions] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<string | null>(null);
  const [accountName, setAccountName] = useState("");
  const [renaming, setRenaming] = useState<StudioConnection | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const queryClient = useQueryClient();

  // The OAuth popup posts this back once a real connection is saved
  // server-side, so the list picks it up without a manual refresh.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "social-connection-added") {
        queryClient.invalidateQueries({ queryKey: studioConnectionsQueryKey(studioId) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient, studioId]);

  const connect = (platform: string, name: string) => {
    const params = new URLSearchParams({ name });
    window.open(
      `/api/studios/${studioId}/oauth/${platform}/start?${params}`,
      "oauth-connect",
      "width=520,height=680"
    );
  };

  const closeConnectDialog = () => {
    setShowConnectOptions(false);
    setConnectPlatform(null);
    setAccountName("");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Connected accounts</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConnectOptions((v) => !v)}
          >
            <Plus className="size-3.5" />
            Add account
          </Button>
        </div>
        {(connections.data?.connections ?? []).length === 0 ? (
          <div className="mt-3 flex flex-col items-center gap-1.5 rounded-2xl border border-dashed p-8 text-center">
            <Link2 className="mb-1 size-5 text-muted-foreground" />
            <p className="text-sm font-semibold">No accounts connected</p>
            <p className="text-sm text-muted-foreground">
              Connect your YouTube, TikTok, or other social accounts to post your videos.
            </p>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {connections.data?.connections.map((c) => {
              const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
              const health = connectionHealth(c);
              return (
                <div key={c.id} className="relative flex flex-col gap-2.5 rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {c.profileImage ? (
                        <div className="relative size-8 shrink-0">
                          <div className="size-8 overflow-hidden rounded-full bg-muted">
                            {/* eslint-disable-next-line @next/next/no-img-element -- external platform avatar */}
                            <img src={c.profileImage} alt="" className="size-full object-cover" />
                          </div>
                          <Icon className="absolute -right-1 -bottom-1 size-3.5 rounded-[25%] ring-2 ring-background" />
                        </div>
                      ) : (
                        <Icon className="size-8 shrink-0 rounded-[25%]" />
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-sm font-medium">
                          <span className="truncate">{c.accountName}</span>
                          {health.ok ? (
                            <CircleCheck className="size-3.5 shrink-0 text-emerald-500" />
                          ) : (
                            <CircleX className="size-3.5 shrink-0 text-destructive" />
                          )}
                        </p>
                        {c.accountHandle && <p className="text-xs text-muted-foreground">{c.accountHandle}</p>}
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setMenuOpenId(menuOpenId === c.id ? null : c.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                      {menuOpenId === c.id && (
                        <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border bg-popover p-1 text-xs shadow-md">
                          <button
                            type="button"
                            onClick={() => {
                              setRenaming(c);
                              setRenameValue(c.accountName);
                              setMenuOpenId(null);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              connect(c.platform, c.accountName);
                              setMenuOpenId(null);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                          >
                            Reconnect
                          </button>
                          <button
                            type="button"
                            disabled={disconnect.isPending}
                            onClick={() => {
                              disconnect.mutate(c.id);
                              setMenuOpenId(null);
                            }}
                            className="block w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("text-xs", health.ok ? "text-muted-foreground" : "text-destructive")}>
                      {health.label}
                    </p>
                    {!health.ok && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => connect(c.platform, c.accountName)}
                      >
                        Reconnect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showConnectOptions} onOpenChange={(open) => !open && closeConnectDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a new account</DialogTitle>
          </DialogHeader>
          {!connectPlatform ? (
            <div className="grid grid-cols-2 gap-2.5">
              {SOCIAL_APP_SEED.filter((s) => OAUTH_CAPABLE_PLATFORMS.includes(s.platform)).map((s) => {
                const Icon = PLATFORM_ICONS[s.platform] ?? Link2;
                const canPublish = PUBLISHABLE_PLATFORMS.includes(s.platform);
                return (
                  <button
                    key={s.platform}
                    type="button"
                    onClick={() => {
                      setConnectPlatform(s.platform);
                      setAccountName("");
                    }}
                    className="flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
                  >
                    <Icon className="size-9 shrink-0 rounded-[25%]" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground">{canPublish ? "Publish" : "Connect"}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            (() => {
              const spec = SOCIAL_APP_SEED.find((s) => s.platform === connectPlatform);
              if (!spec) return null;
              return (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setConnectPlatform(null)}
                    className="text-xs text-primary hover:underline"
                  >
                    ← Change platform
                  </button>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name this connection</Label>
                    <Input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder={spec.label}
                      autoFocus
                    />
                  </div>
                  {META_PICKER_NOTES[connectPlatform] && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {META_PICKER_NOTES[connectPlatform]}
                    </p>
                  )}
                  <Button
                    className="w-full"
                    disabled={!accountName.trim()}
                    onClick={() => {
                      connect(connectPlatform, accountName.trim());
                      closeConnectDialog();
                    }}
                  >
                    Connect via {spec.label}
                  </Button>
                </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename connection</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
          </div>
          {rename.isError && (
            <p className="text-xs text-destructive">
              {rename.error instanceof ApiError ? rename.error.message : "Couldn't rename that connection."}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renameValue.trim() || rename.isPending}
              onClick={() => {
                if (!renaming) return;
                rename.mutate(
                  { accountName: renameValue.trim(), connectionId: renaming.id },
                  { onSuccess: () => setRenaming(null) },
                );
              }}
            >
              {rename.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkflowConnectionPill({
  connection,
}: {
  connection: { platform: string; accountName: string; accountHandle: string | null };
}) {
  const Icon = PLATFORM_ICONS[connection.platform] ?? Link2;
  return (
    <span
      className="inline-flex"
      title={`${connection.accountName}${connection.accountHandle ? ` (${connection.accountHandle})` : ""}`}
    >
      <Icon className="size-9 rounded-[25%]" />
    </span>
  );
}

function WorkflowSection({ studioId }: { studioId: string }) {
  const connections = useStudioConnections(studioId);
  const workflows = useStudioWorkflows(studioId);
  const del = useDeleteStudioWorkflow(studioId);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const hasEnoughConnections = (connections.data?.connections.length ?? 0) >= 2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Workflows</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasEnoughConnections}
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" />
          New workflow
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Pair two connected accounts to repurpose content between them. Nothing publishes
        automatically yet — Auto Publish is stored for when that&apos;s built.
      </p>

      {!hasEnoughConnections ? (
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed p-8 text-center">
          <Link2 className="mb-1 size-5 text-muted-foreground" />
          <p className="text-sm font-semibold">Connect at least two accounts</p>
          <p className="text-sm text-muted-foreground">Add accounts under Connections, then pair them here.</p>
        </div>
      ) : (workflows.data?.workflows ?? []).length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          {workflows.isLoading ? "Loading…" : "No workflows yet."}
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.data?.workflows.map((w) => (
            <WorkflowCard
              key={w.id}
              studioId={studioId}
              workflow={w}
              menuOpen={menuOpenId === w.id}
              onToggleMenu={() => setMenuOpenId(menuOpenId === w.id ? null : w.id)}
              onDelete={() => {
                del.mutate(w.id);
                setMenuOpenId(null);
              }}
              deleting={del.isPending}
            />
          ))}
        </div>
      )}

      <CreateWorkflowDialog studioId={studioId} open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function WorkflowCard({
  studioId,
  workflow,
  menuOpen,
  onToggleMenu,
  onDelete,
  deleting,
}: {
  studioId: string;
  workflow: StudioWorkflow;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const update = useUpdateStudioWorkflow(studioId);

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{workflow.name}</p>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 w-32 rounded-lg border bg-popover p-1 text-xs shadow-md">
              <button
                type="button"
                disabled={deleting}
                onClick={onDelete}
                className="block w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <WorkflowConnectionPill connection={workflow.sourceConnection} />
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <WorkflowConnectionPill connection={workflow.destinationConnection} />
        </div>
        <button
          type="button"
          disabled={update.isPending}
          onClick={() =>
            update.mutate({
              status: workflow.status === "Active" ? "Inactive" : "Active",
              workflowId: workflow.id,
            })
          }
          className={cn(
            "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
            workflow.status === "Active"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {workflow.status}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2">
        <span className="text-xs font-medium">Auto Publish</span>
        <Switch
          checked={workflow.autoPublish}
          onCheckedChange={(v) => update.mutate({ autoPublish: v, workflowId: workflow.id })}
          aria-label="Auto publish"
        />
      </div>
    </div>
  );
}

function CreateWorkflowDialog({
  studioId,
  open,
  onClose,
}: {
  studioId: string;
  open: boolean;
  onClose: () => void;
}) {
  const connections = useStudioConnections(studioId);
  const create = useCreateStudioWorkflow(studioId);
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [destinationId, setDestinationId] = useState("");

  const options = connections.data?.connections ?? [];

  const submit = () => {
    if (!name.trim() || !sourceId || !destinationId || sourceId === destinationId) return;
    create.mutate(
      { destinationConnectionId: destinationId, name: name.trim(), sourceConnectionId: sourceId },
      {
        onSuccess: () => {
          setName("");
          setSourceId("");
          setDestinationId("");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New workflow</DialogTitle>
          <DialogDescription>Pair two of this studio&apos;s connected accounts.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Workflow name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shorts to X" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Repurpose from</Label>
            <Select value={sourceId} onValueChange={(value) => setSourceId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Repurpose to</Label>
            <Select value={destinationId} onValueChange={(value) => setDestinationId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {options
                  .filter((c) => c.id !== sourceId)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.accountName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {create.isError && (
            <p className="text-xs text-destructive">
              {create.error instanceof ApiError ? create.error.message : "Couldn't create that workflow."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || !sourceId || !destinationId || create.isPending} onClick={submit}>
            {create.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Create workflow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
