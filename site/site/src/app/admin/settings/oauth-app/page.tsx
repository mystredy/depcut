"use client";

import { useState } from "react";
import {
  AtSign,
  Camera,
  Eye,
  EyeOff,
  Film,
  Ghost,
  Hash,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Video,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";
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
  instagram: Camera,
  snapchat: Ghost,
  telegram: Send,
  threads: AtSign,
  tiktok: Share2,
  x: Hash,
  youtube: Video,
  youtube_shorts: Film,
};

export default function AdminOAuthAppPage() {
  const socialApps = useAdminSocialApps();
  const [selected, setSelected] = useState(SOCIAL_APP_SEED[0].platform);

  const spec = SOCIAL_APP_SEED.find((s) => s.platform === selected)!;
  const row = socialApps.data?.socialApps.find((a) => a.platform === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">OAuth App</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials for each social platform&apos;s API. No publish integration is wired up to
          use these yet — this just stores them for when that pipeline is built.
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
              {SOCIAL_APP_SEED.map((s) => {
                const Icon = PLATFORM_ICONS[s.platform];
                const isActive = selected === s.platform;
                const configured = socialApps.data?.socialApps.find((a) => a.platform === s.platform)
                  ?.configuredFields.length;
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
                    {Boolean(configured) && (
                      <span className="absolute right-1 bottom-1 size-1.5 rounded-full bg-emerald-500" />
                    )}
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

  const save = () => {
    update.mutate(
      { credentials: values, id: row.id },
      { onSuccess: () => setValues({}) }
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
          setVisible((prev) => ({ ...prev, [key]: true }));
        },
      }
    );
  };

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h4 className="text-sm font-semibold">{spec.label} settings</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{spec.description}</p>
        </div>
        <Switch
          checked={row.enabled}
          onCheckedChange={(v) => update.mutate({ enabled: v, id: row.id })}
          aria-label={`Enable ${spec.label}`}
        />
      </div>

      <div className="space-y-3">
        {spec.fields.map((f) => {
          const isSet = row.configuredFields.includes(f.key);
          const isSecret = f.type === "password";
          // Non-secret fields show their real saved value and are directly
          // editable. Secret fields stay masked and blank until the admin
          // clicks reveal — which fetches that one field's value on demand
          // (see useRevealSocialAppField) — after which it's shown and
          // editable in place; toggling back off just re-masks it locally.
          const displayValue = values[f.key] ?? (f.type === "text" ? row.values[f.key] ?? "" : "");
          const inputType = isSecret && !visible[f.key] ? "password" : "text";
          return (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">
                {f.label} {isSet && isSecret && <span className="text-muted-foreground">(set)</span>}
              </Label>
              <div className="relative">
                <Input
                  type={inputType}
                  value={displayValue}
                  onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={isSecret && isSet ? "•••••••• (leave blank to keep)" : f.label}
                  className={isSecret && isSet ? "pr-9" : undefined}
                />
                {isSecret && isSet && (
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
        })}
      </div>

      <Button className="w-full" disabled={update.isPending} onClick={save}>
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save
      </Button>
    </div>
  );
}
