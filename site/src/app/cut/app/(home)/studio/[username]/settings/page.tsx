"use client";

import { use, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  Camera,
  Film,
  Ghost,
  Hash,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  Send,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StudioSwitcher } from "@/cut/components/StudioSwitcher";
import { OAUTH_CAPABLE_PLATFORMS, PUBLISHABLE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";
import { cn } from "@/lib/utils";
import {
  useStudioActivity,
  useStudioByUsername,
  useStudioConnections,
  useStudioInvites,
  useStudioMembers,
  useDeleteStudio,
  useDisconnectStudioConnection,
  useRemoveStudioMember,
  useRequestStudioInviteCode,
  useRevokeStudioInvite,
  useSendStudioInvite,
  useUpdateStudio,
  studioConnectionsQueryKey,
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

const LINKED_ACCOUNT_PLATFORMS = ["facebook", "instagram", "x", "tiktok", "youtube", "threads", "snapchat"];

type Section = "setup" | "access" | "history" | "linked" | "repurpose";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "setup", label: "Studio setup" },
  { key: "access", label: "Studio access" },
  { key: "history", label: "Management history" },
  { key: "linked", label: "Linked accounts" },
  { key: "repurpose", label: "Repurpose" },
];

export default function StudioSettingsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { data, isLoading } = useStudioByUsername(username);
  const [section, setSection] = useState<Section>("setup");

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
      <div className="pt-4">
        <StudioSwitcher currentUsername={studio.username} />
      </div>

      <h1 className="mt-4 text-lg font-semibold tracking-tight">{studio.name} — Settings</h1>

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

      <div className="pt-6">
        {section === "setup" && <SetupSection studioId={studio.id} studio={studio} />}
        {section === "access" && <AccessSection studioId={studio.id} isOwner={studio.role === "owner"} />}
        {section === "history" && <HistorySection studioId={studio.id} />}
        {section === "linked" && <LinkedAccountsSection studioId={studio.id} linkedAccounts={studio.linkedAccounts} />}
        {section === "repurpose" && <RepurposeSection studioId={studio.id} />}
      </div>
    </div>
  );
}

function SetupSection({
  studioId,
  studio,
}: {
  studioId: string;
  studio: { name: string; username: string; bio: string | null; spaceType: string; showFollowerCount: boolean };
}) {
  const update = useUpdateStudio(studioId);
  const del = useDeleteStudio();
  const [name, setName] = useState(studio.name);
  const [username, setUsername] = useState(studio.username);
  const [bio, setBio] = useState(studio.bio ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const dirty =
    name.trim() !== studio.name || username.trim() !== studio.username || bio.trim() !== (studio.bio ?? "");

  const save = () => {
    update.mutate({
      bio: bio.trim() || null,
      name: name.trim(),
      username: username.trim(),
    });
  };

  return (
    <div className="max-w-md space-y-5">
      <div className="space-y-1.5">
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
        <p className="text-sm">{studio.spaceType}</p>
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
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={del.isPending}
              onClick={() => del.mutate(studioId, { onSuccess: () => (window.location.href = "/app/studio") })}
            >
              {del.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Confirm delete
            </Button>
          </div>
        ) : (
          <Button variant="destructive" size="sm" className="mt-3" onClick={() => setConfirmingDelete(true)}>
            Delete studio
          </Button>
        )}
      </div>
    </div>
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

  // Resets challenge/code the moment the target email changes (including to
  // null on close), in render rather than an effect — React's documented
  // pattern for adjusting state when a prop changes.
  const [trackedEmail, setTrackedEmail] = useState(email);
  if (email !== trackedEmail) {
    setTrackedEmail(email);
    setChallenge(null);
    setCode("");
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
    requestCode.mutate(email, { onSuccess: (result) => setChallenge(result.challenge) });
  };

  const confirm = () => {
    if (!email || !challenge) return;
    sendInvite.mutate(
      { challenge, code, email },
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
          <Button disabled={!challenge || code.length !== 6 || sendInvite.isPending} onClick={confirm}>
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

function LinkedAccountsSection({
  studioId,
  linkedAccounts,
}: {
  studioId: string;
  linkedAccounts: Record<string, string>;
}) {
  const update = useUpdateStudio(studioId);
  // The parent only renders this section once the studio has loaded, so
  // linkedAccounts is already its final value at mount — no effect needed
  // to keep it in sync.
  const [handles, setHandles] = useState<Record<string, string>>(linkedAccounts);

  const normalize = (record: Record<string, string>) =>
    JSON.stringify(
      Object.entries(record)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => [k, v.trim()])
        .sort(([a], [b]) => a.localeCompare(b)),
    );
  const dirty = normalize(handles) !== normalize(linkedAccounts);

  return (
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        Public handles shown on this studio&apos;s profile — display text only, not a real connection.
      </p>
      {LINKED_ACCOUNT_PLATFORMS.map((platform) => {
        const Icon = PLATFORM_ICONS[platform] ?? Link2;
        const spec = SOCIAL_APP_SEED.find((s) => s.platform === platform);
        return (
          <div key={platform} className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={handles[platform] ?? ""}
              onChange={(e) => setHandles((prev) => ({ ...prev, [platform]: e.target.value }))}
              placeholder={`${spec?.label ?? platform} username`}
            />
          </div>
        );
      })}
      <Button
        disabled={!dirty || update.isPending}
        onClick={() =>
          update.mutate({
            linkedAccounts: Object.fromEntries(Object.entries(handles).filter(([, v]) => v.trim())),
          })
        }
      >
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>
    </div>
  );
}

function RepurposeSection({ studioId }: { studioId: string }) {
  const connections = useStudioConnections(studioId);
  const disconnect = useDisconnectStudioConnection(studioId);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
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

  const connect = (platform: string) => {
    window.open(
      `/api/studios/${studioId}/oauth/${platform}/start`,
      "oauth-connect",
      "width=520,height=680"
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold">Connected accounts</p>
        {(connections.data?.connections ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No accounts connected yet.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {connections.data?.connections.map((c) => {
              const Icon = PLATFORM_ICONS[c.platform] ?? Link2;
              return (
                <div key={c.id} className="relative flex items-center justify-between gap-3 rounded-2xl border p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
                      {c.profileImage ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external platform avatar
                        <img src={c.profileImage} alt="" className="size-full object-cover" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.accountName}</p>
                      {c.accountHandle && <p className="text-xs text-muted-foreground">{c.accountHandle}</p>}
                    </div>
                  </div>
                  <div className="relative">
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
                          disabled={disconnect.isPending}
                          onClick={() => {
                            disconnect.mutate(c.id);
                            setMenuOpenId(null);
                          }}
                          className="block w-full rounded px-2 py-1.5 text-left text-destructive hover:bg-destructive/10"
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold">Connect a new account</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SOCIAL_APP_SEED.filter((s) => OAUTH_CAPABLE_PLATFORMS.includes(s.platform)).map((s) => {
            const Icon = PLATFORM_ICONS[s.platform] ?? Link2;
            const canPublish = PUBLISHABLE_PLATFORMS.includes(s.platform);
            return (
              <button
                key={s.platform}
                type="button"
                onClick={() => connect(s.platform)}
                className="flex items-center gap-2.5 rounded-xl border p-3 text-left transition-colors hover:border-ring hover:bg-muted/40"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.label}</p>
                  <p className="text-[11px] text-muted-foreground">{canPublish ? "Publish" : "Connect"}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
