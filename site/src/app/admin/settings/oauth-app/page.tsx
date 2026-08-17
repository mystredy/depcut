"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AtSign,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  Film,
  Ghost,
  Hash,
  HelpCircle,
  Loader2,
  LogIn,
  MessageCircle,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";

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
  useRevealSocialAppField,
  useUpdateSocialApp,
} from "@/queries/admin";

// lucide-react dropped brand/logo icons (Facebook, Instagram, Twitter,
// Youtube, ...) — these are generic stand-ins, not the real logos.
const PLATFORM_ICONS: Record<string, LucideIcon> = {
  facebook: MessageCircle,
  google: LogIn,
  instagram: Camera,
  snapchat: Ghost,
  threads: AtSign,
  tiktok: Share2,
  x: Hash,
  youtube: Video,
  youtube_shorts: Film,
};

// The Telegram bot has its own dedicated pages at /admin/telegram-bot/* —
// including its Login callback, which reuses the bot's own credentials
// rather than a separate OAuth app — so it never appears here.
const OAUTH_APP_PLATFORMS = SOCIAL_APP_SEED.filter((s) => s.platform !== "telegram");

export default function AdminOAuthAppPage() {
  const socialApps = useAdminSocialApps();
  const [selected, setSelected] = useState(OAUTH_APP_PLATFORMS[0].platform);

  const spec = OAUTH_APP_PLATFORMS.find((s) => s.platform === selected)!;
  const row = socialApps.data?.socialApps.find((a) => a.platform === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">OAuth App</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials for each social platform&apos;s API. Saving here also writes to this
          server&apos;s environment — Google Sign-In reads it live; no publish integration reads
          the others yet, so those are just stored for when that pipeline is built.
        </p>
      </div>

      {socialApps.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : socialApps.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load social apps. Try again.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-4">
            <p className="px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Select Social Provider
            </p>
            <div className="flex flex-wrap gap-2">
              {OAUTH_APP_PLATFORMS.map((s) => {
                const Icon = PLATFORM_ICONS[s.platform];
                const isActive = selected === s.platform;
                const row = socialApps.data?.socialApps.find((a) => a.platform === s.platform);
                // Red: not set on the server. Yellow: set but not enabled.
                // Green: enabled.
                const dotColor = row?.enabled
                  ? "bg-emerald-500"
                  : row?.envConfigured
                    ? "bg-amber-500"
                    : "bg-red-500";
                return (
                  <button
                    key={s.platform}
                    type="button"
                    onClick={() => setSelected(s.platform)}
                    title={s.label}
                    className={cn(
                      "relative flex size-11 items-center justify-center rounded-xl border transition-colors",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent bg-muted/60 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-5" />
                    <span className={cn("absolute right-1 bottom-1 size-1.5 rounded-full", dotColor)} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8">
            {row && <PlatformForm key={row.id} spec={spec} row={row} />}
          </div>
        </div>
      )}
    </div>
  );
}

function PlatformForm({ spec, row }: { spec: (typeof SOCIAL_APP_SEED)[number]; row: AdminSocialApp }) {
  const update = useUpdateSocialApp();
  const reveal = useRevealSocialAppField();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [revealingKey, setRevealingKey] = useState<string | null>(null);
  // Baseline for what "reveal" fetched per field, so viewing a secret isn't
  // itself counted as an edit — only diverging from it after is.
  const [revealedValues, setRevealedValues] = useState<Record<string, string>>({});

  const hasChanges = spec.fields.some((f) => {
    if (f.readOnly) return false;
    const edited = values[f.key];
    if (edited === undefined) return false;
    return f.type === "password"
      ? edited.trim() !== "" && edited !== revealedValues[f.key]
      : edited !== (row.values[f.key] ?? "");
  });

  const save = () => {
    const credentials: Record<string, string> = {};
    for (const f of spec.fields) {
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

  const renderField = (f: SocialAppField) => {
    if (f.readOnly) {
      return (
        <div className="space-y-1.5">
          <Label className="text-xs">{f.label}</Label>
          <Input value={row.values[f.key] ?? ""} disabled placeholder="Derived automatically" />
        </div>
      );
    }
    const isSet = row.configuredFields.includes(f.key);
    const isSecret = f.type === "password";
    // Non-secret fields show their real saved value and are directly
    // editable. Secret fields stay masked until the admin clicks reveal —
    // which either shows a value already typed locally, or fetches the
    // saved one on demand (see useRevealSocialAppField); toggling back off
    // just re-masks it locally.
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
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold">Update Credential: {spec.label}</h4>
            {spec.helpSteps && <HelpButton steps={spec.helpSteps} />}
            {row.envConfigured !== undefined && (
              <span
                title={
                  row.envConfigured
                    ? "Live: already set on the server — that's what's actually used, not this form."
                    : "Not set on the server yet — saving here writes it to the server's environment."
                }
              >
                {row.envConfigured ? (
                  <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                )}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
        </div>
        <Switch
          checked={row.enabled}
          onCheckedChange={(v) => update.mutate({ enabled: v, id: row.id })}
          disabled={!row.enabled && row.envConfigured === false}
          title={
            !row.enabled && row.envConfigured === false
              ? "Set credentials on the server before enabling"
              : undefined
          }
          aria-label={`Enable ${spec.label}`}
        />
      </div>

      {update.isError && <p className="text-xs text-destructive">{update.error.message}</p>}

      <div className="space-y-3">
        {groupSocialAppFieldRows(spec.fields).map((fieldRow) =>
          fieldRow.length > 1 ? (
            <div key={fieldRow.map((f) => f.key).join("+")} className="grid grid-cols-2 gap-3">
              {fieldRow.map((f) => (
                <div key={f.key}>{renderField(f)}</div>
              ))}
            </div>
          ) : (
            <div key={fieldRow[0].key}>{renderField(fieldRow[0])}</div>
          )
        )}
        {spec.callbackPath && <CallbackUrlField path={spec.callbackPath} />}
      </div>

      <Button className="w-full" disabled={update.isPending || !hasChanges} onClick={save}>
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>
    </div>
  );
}

// The exact URL to register as this provider's authorized redirect URI —
// this origin plus its real callback route. Read-only: it's derived from
// where the admin is browsing from, never typed or saved.
function CallbackUrlField({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  const copy = () => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Callback URL</Label>
      <div className="relative">
        <Input value={url} disabled readOnly className="pr-9 font-mono text-xs" />
        <button
          type="button"
          onClick={copy}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          title="Copy"
        >
          {copied ? (
            <Check className="size-3.5 text-emerald-500" />
          ) : (
            <Copy className="size-3.5" />
          )}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Add this as an authorized redirect URI in the provider&apos;s own console.
      </p>
    </div>
  );
}

// A "?" next to the form title — where to actually go get these
// credentials from the provider's own site.
function HelpButton({ steps }: { steps: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
        title="How to get credentials"
        aria-label="How to get credentials"
      >
        <HelpCircle className="size-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-2 w-72 rounded-xl border bg-popover p-3 text-xs shadow-md">
            <p className="mb-2 font-semibold">How to get credentials</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-muted-foreground">
              {steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
