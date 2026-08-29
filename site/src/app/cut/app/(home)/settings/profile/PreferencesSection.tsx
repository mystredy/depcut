"use client";

import { useState } from "react";
import { ChevronRight, Loader2, Send } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  useNotificationPreferences,
  useSetNotificationPreferences,
} from "@/queries/notificationPreferences";
import {
  type TelegramLinkCredential,
  useCreateTelegramLink,
  useSendUnlinkCode,
  useTelegramLinkStatus,
  useUnlinkTelegram,
} from "@/queries/telegramLink";

// Which channels get proactive alerts. Telegram is the one that actually
// delivers today, once linked — push and the weekly digest save a real
// preference but have no send path built yet (no service worker, no digest
// job); flipping either just records intent for when that lands.
export function PreferencesSection() {
  const prefs = useNotificationPreferences();
  const setPrefs = useSetNotificationPreferences();

  if (!prefs.data) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="text-sm font-medium">Preferences</div>
      <div className="mt-4 divide-y border-t">
        <PreferenceRow
          checked={prefs.data.pushPayouts}
          onCheckedChange={(v) => setPrefs.mutate({ pushPayouts: v === true })}
          subtitle="Alert me directly on system payouts"
          title="Push Notifications"
        />

        <TelegramRow />

        <PreferenceRow
          checked={prefs.data.emailDigest}
          onCheckedChange={(v) => setPrefs.mutate({ emailDigest: v === true })}
          subtitle="Weekly content creation performance recap"
          title="Email Digest"
        />
      </div>
      {setPrefs.isError && (
        <p className="mt-3 text-sm text-red-600">Couldn&apos;t save that change — try again.</p>
      )}
    </div>
  );
}

function TelegramRow() {
  const [expanded, setExpanded] = useState(false);
  const [credential, setCredential] = useState<TelegramLinkCredential | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [codeInput, setCodeInput] = useState("");

  const link = useTelegramLinkStatus(expanded);
  const createLink = useCreateTelegramLink();
  const sendUnlinkCode = useSendUnlinkCode();
  const unlink = useUnlinkTelegram();
  const prefs = useNotificationPreferences();
  const setPrefs = useSetNotificationPreferences();

  if (!link.data || !prefs.data) return null;
  const { linked, telegramUsername } = link.data;

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !linked && !credential) {
      createLink.mutate(undefined, { onSuccess: setCredential });
    }
  };

  const requestUnlink = () => {
    sendUnlinkCode.mutate(undefined, { onSuccess: () => setCodeSent(true) });
  };

  const cancelUnlink = () => {
    setCodeSent(false);
    setCodeInput("");
  };

  const confirmUnlink = () => {
    unlink.mutate(codeInput.trim(), {
      onSuccess: () => {
        setCredential(null);
        setCodeSent(false);
        setCodeInput("");
        setExpanded(false);
      },
    });
  };

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={toggleExpand}
        className="group flex w-full items-center justify-between gap-3 py-4 text-left first:pt-0"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">Telegram Alerts &amp; Bot</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {linked
              ? `Linked as @${telegramUsername ?? "…"} — real-time notifications DM here.`
              : "Link your secure Telegram identity for real-time notifications."}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {linked ? (
            <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
              </span>
              Connected
            </span>
          ) : (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-primary uppercase">
              Link bot
            </span>
          )}
          <ChevronRight
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-90"
            )}
          />
        </span>
      </button>

      {expanded && (
        <div className="pb-4">
          {linked ? (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between gap-6">
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Real-time notifications</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    DM alerts to your linked Telegram, alongside the notification bell.
                  </span>
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <Switch
                    aria-label="Telegram real-time notifications"
                    checked={prefs.data.telegramAlerts}
                    onCheckedChange={(v) => setPrefs.mutate({ telegramAlerts: v === true })}
                  />
                  {!codeSent && (
                    <button
                      type="button"
                      disabled={sendUnlinkCode.isPending}
                      onClick={requestUnlink}
                      className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-60"
                    >
                      {sendUnlinkCode.isPending ? "Sending code…" : "Unlink"}
                    </button>
                  )}
                </div>
              </div>

              {codeSent && (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs text-muted-foreground">
                    We sent a code to your linked Telegram — enter it to confirm unlinking.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      value={codeInput}
                      onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="6-digit code"
                      inputMode="numeric"
                      className="w-32 rounded-md border bg-card px-2.5 py-1 font-mono text-sm tracking-widest outline-none focus-visible:border-ring"
                    />
                    <button
                      type="button"
                      disabled={codeInput.length !== 6 || unlink.isPending}
                      onClick={confirmUnlink}
                      className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {unlink.isPending ? "Confirming…" : "Confirm unlink"}
                    </button>
                    <button
                      type="button"
                      onClick={cancelUnlink}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                  {unlink.isError && (
                    <p className="text-xs text-red-600">That code is wrong or expired — try again.</p>
                  )}
                </div>
              )}
            </div>
          ) : createLink.isPending || !credential ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Generating a link…
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <a
                href={credential.deepLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                <Send className="size-3.5" /> Open in Telegram
              </a>
              <p className="text-xs text-muted-foreground">
                Or message{" "}
                <span className="font-medium text-foreground">@{credential.botUsername}</span> directly
                with this code:
              </p>
              <p className="w-fit rounded-md border bg-card px-2.5 py-1 font-mono text-sm font-semibold tracking-widest">
                {credential.pin}
              </p>
              <p className="text-[11px] text-muted-foreground">Expires in 15 minutes.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PreferenceRow({
  title,
  subtitle,
  checked,
  onCheckedChange,
}: {
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <Switch aria-label={title} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
    </div>
  );
}
