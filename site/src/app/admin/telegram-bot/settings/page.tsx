"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  groupSocialAppFieldRows,
  SOCIAL_APP_SEED,
  type SocialAppField,
} from "@/lib/marketplace/social-apps-seed";
import { cn } from "@/lib/utils";
import {
  type AdminSocialApp,
  useAdminSocialApps,
  useAdminTelegramNotifications,
  useRevealSocialAppField,
  useUpdateSocialApp,
  useUpdateTelegramNotifications,
} from "@/queries/admin";

const TELEGRAM_SPEC = SOCIAL_APP_SEED.find((s) => s.platform === "telegram")!;

// The bot's own credentials and its notification routing, together — the
// one place to set up the Telegram bot. Status and connected channels live
// on Overview instead.
export default function AdminTelegramSettingsPage() {
  const socialApps = useAdminSocialApps();
  const row = socialApps.data?.socialApps.find((a) => a.platform === "telegram");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Telegram Bot Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">{TELEGRAM_SPEC.description}</p>
      </div>

      {socialApps.isLoading ? (
        <Skeleton className="h-72 w-full max-w-2xl" />
      ) : socialApps.isError || !row ? (
        <p className="text-sm text-destructive">Couldn&apos;t load the Telegram bot. Try again.</p>
      ) : (
        <BotForm key={row.id} row={row} />
      )}

      <NotificationRoutingForm adminId={row?.values.adminId ?? null} />
    </div>
  );
}

function BotForm({ row }: { row: AdminSocialApp }) {
  const update = useUpdateSocialApp();
  const reveal = useRevealSocialAppField();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [revealingKey, setRevealingKey] = useState<string | null>(null);
  // Baseline for what "reveal" fetched per field, so viewing a secret isn't
  // itself counted as an edit — only diverging from it after is.
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});

  const hasChanges = TELEGRAM_SPEC.fields.some((f) => {
    if (f.readOnly) return false;
    const edited = values[f.key];
    if (edited === undefined) return false;
    return f.type === "password"
      ? edited.trim() !== "" && edited !== revealedValues[f.key]
      : edited !== (row.values[f.key] ?? "");
  });

  const save = () => {
    const credentials: Record<string, string> = {};
    for (const f of TELEGRAM_SPEC.fields) {
      if (f.readOnly) continue;
      const edited = values[f.key];
      if (edited === undefined) continue;
      if (f.type === "password" && (edited.trim() === "" || edited === revealedValues[f.key])) continue;
      credentials[f.key] = edited;
    }
    update.mutate(
      { credentials, id: row.id },
      {
        onSuccess: () => {
          setValues({});
          setRevealedValues({});
        },
      }
    );
  };

  const toggleReveal = (key: string) => {
    if (visible[key]) {
      setVisible((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (values[key] !== undefined) {
      setVisible((prev) => ({ ...prev, [key]: true }));
      return;
    }
    setRevealingKey(key);
    reveal.mutate(
      { field: key, id: row.id },
      {
        onSettled: () => setRevealingKey(null),
        onSuccess: (data) => {
          setValues((prev) => ({ ...prev, [key]: data.value ?? "" }));
          setRevealedValues((prev) => ({ ...prev, [key]: data.value ?? "" }));
          setVisible((prev) => ({ ...prev, [key]: true }));
        },
      }
    );
  };

  const renderBotField = (f: SocialAppField) => {
    const isSet = row.configuredFields.includes(f.key);
    const isSecret = f.type === "password";
    if (f.readOnly) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{f.label}</Label>
          <Input
            value={row.values[f.key] ?? ""}
            disabled
            placeholder="Fetched from Telegram once a token is saved"
          />
        </div>
      );
    }
    const displayValue = values[f.key] ?? (f.type === "text" ? row.values[f.key] ?? "" : "");
    const canReveal = isSecret && (isSet || values[f.key] !== undefined);
    const inputType = isSecret && !visible[f.key] ? "password" : "text";
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">
          {f.label} {isSet && isSecret && <span className="text-muted-foreground">(set)</span>}
        </Label>
        <div className="relative">
          <Input
            type={inputType}
            value={displayValue}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={isSecret && isSet ? "•••••••• (leave blank to keep)" : f.label}
            className={canReveal ? "pr-9" : undefined}
          />
          {canReveal && (
            <button
              type="button"
              onClick={() => toggleReveal(f.key)}
              disabled={revealingKey === f.key}
              className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
              title={visible[f.key] ? "Hide" : "Reveal"}
            >
              {revealingKey === f.key ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : visible[f.key] ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-sm font-semibold">Bot settings</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.configuredFields.length > 0 ? "Credentials saved" : "No credentials saved yet"}
          </p>
        </div>
        <Switch
          checked={row.enabled}
          onCheckedChange={(v) => update.mutate({ enabled: v, id: row.id })}
          aria-label="Enable Telegram bot"
        />
      </div>

      {update.isError && <p className="text-xs text-destructive">{update.error.message}</p>}

      <div className="space-y-3">
        {groupSocialAppFieldRows(TELEGRAM_SPEC.fields).map((fieldRow) =>
          fieldRow.length > 1 ? (
            <div key={fieldRow.map((f) => f.key).join("+")} className="grid grid-cols-2 gap-3">
              {fieldRow.map((f) => (
                <div key={f.key}>{renderBotField(f)}</div>
              ))}
            </div>
          ) : (
            <div key={fieldRow[0].key}>{renderBotField(fieldRow[0])}</div>
          )
        )}
      </div>

      <Button className="w-full" disabled={update.isPending || !hasChanges} onClick={save}>
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>
    </div>
  );
}

// Which admin events push a message to the bot's destinations — the admin,
// group, and channel, all set above in Bot settings — every non-empty one
// gets every enabled event, it's not a choice of one. This form only owns
// the per-event toggles.
function NotificationRoutingForm({ adminId }: { adminId: string | null }) {
  const settings = useAdminTelegramNotifications();
  const update = useUpdateTelegramNotifications();

  const [notifySubmissions, setNotifySubmissions] = useState(false);
  const [notifyWithdrawals, setNotifyWithdrawals] = useState(false);
  const [notifySupportTickets, setNotifySupportTickets] = useState(false);
  const [notifySignups, setNotifySignups] = useState(false);

  useEffect(() => {
    const s = settings.data?.settings;
    if (!s) return;
    setNotifySubmissions(s.notifySubmissions);
    setNotifyWithdrawals(s.notifyWithdrawals);
    setNotifySupportTickets(s.notifySupportTickets);
    setNotifySignups(s.notifySignups);
  }, [settings.data]);

  const s = settings.data?.settings;
  const hasChanges =
    Boolean(s) &&
    (notifySubmissions !== s!.notifySubmissions ||
      notifyWithdrawals !== s!.notifyWithdrawals ||
      notifySupportTickets !== s!.notifySupportTickets ||
      notifySignups !== s!.notifySignups);

  const save = () => {
    update.mutate({ notifySignups, notifySubmissions, notifySupportTickets, notifyWithdrawals });
  };

  return (
    <div>
      <p className="mb-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Notification routing
      </p>

      {settings.isLoading ? (
        <Skeleton className="h-64 w-full max-w-2xl" />
      ) : settings.isError || !s ? (
        <p className="text-sm text-destructive">Couldn&apos;t load notification settings. Try again.</p>
      ) : (
        <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
          <div className="flex items-center gap-1.5 rounded-xl border p-3">
            {adminId ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <p className="text-xs text-muted-foreground">
              {adminId
                ? `Notifies the admin (${adminId}), group, and channel set above in Bot settings.`
                : "Set an Admin ID above in Bot settings to notify the admin — the group and channel notify too, once set."}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notify on
            </p>
            {[
              { label: "New submission", value: notifySubmissions, set: setNotifySubmissions },
              { label: "Withdrawal request", value: notifyWithdrawals, set: setNotifyWithdrawals },
              { label: "Support ticket", value: notifySupportTickets, set: setNotifySupportTickets },
              { label: "New signup", value: notifySignups, set: setNotifySignups },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">{row.label}</span>
                <Switch checked={row.value} onCheckedChange={row.set} aria-label={row.label} />
              </div>
            ))}
          </div>

          <Button disabled={update.isPending || !hasChanges} onClick={save}>
            {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
