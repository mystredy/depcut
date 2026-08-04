"use client";

import { use, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  API_INTEGRATION_LABELS,
  API_INTEGRATION_SEED,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";
import {
  type AdminApiIntegration,
  useAdminApiIntegrations,
  useRevealApiIntegrationKey,
  useUpdateApiIntegration,
} from "@/queries/admin";

export default function AdminApiIntegrationPage({
  params,
}: {
  params: Promise<{ provider: string }>;
}) {
  const { provider } = use(params);
  const integrations = useAdminApiIntegrations();

  if (!API_INTEGRATION_SEED.includes(provider as ApiIntegrationProvider)) {
    return <p className="text-sm text-destructive">Unknown provider &quot;{provider}&quot;.</p>;
  }

  const label = API_INTEGRATION_LABELS[provider as ApiIntegrationProvider];
  const row = integrations.data?.integrations.find((i) => i.provider === provider);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">API Integration: {label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Credentials and gateway settings for {label}. Stored here for reference and rotation —
          the real inference calls still read their key from this server&apos;s environment
          variables, not from this table.
        </p>
      </div>

      {integrations.isLoading ? (
        <Skeleton className="h-72 w-full max-w-2xl" />
      ) : integrations.isError || !row ? (
        <p className="text-sm text-destructive">Couldn&apos;t load this integration. Try again.</p>
      ) : (
        <ProviderForm key={row.id} label={label} row={row} />
      )}
    </div>
  );
}

function ProviderForm({ label, row }: { label: string; row: AdminApiIntegration }) {
  const update = useUpdateApiIntegration();
  const reveal = useRevealApiIntegrationKey();

  const [apiKeyValue, setApiKeyValue] = useState<string | undefined>(undefined);
  const [baseUrl, setBaseUrl] = useState(row.baseUrl ?? "");
  const [visible, setVisible] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const toggleReveal = () => {
    if (visible) {
      setVisible(false);
      return;
    }
    if (apiKeyValue !== undefined) {
      setVisible(true);
      return;
    }
    setRevealing(true);
    reveal.mutate(row.id, {
      onSettled: () => setRevealing(false),
      onSuccess: (data) => {
        setApiKeyValue(data.value ?? "");
        setVisible(true);
      },
    });
  };

  const save = () => {
    update.mutate(
      {
        baseUrl,
        id: row.id,
        ...(apiKeyValue?.trim() ? { apiKey: apiKeyValue.trim() } : {}),
      },
      { onSuccess: () => setApiKeyValue(undefined) }
    );
  };

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {row.hasApiKey ? "API key is set" : "No API key saved yet"}
          </p>
        </div>
        <span
          className={
            row.status === "Active"
              ? "rounded-full bg-emerald-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400"
              : "rounded-full bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-400"
          }
        >
          ● {row.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">
            API Key Credentials {row.hasApiKey && <span className="text-muted-foreground">(set)</span>}
          </Label>
          <div className="relative">
            <Input
              type={visible ? "text" : "password"}
              value={apiKeyValue ?? ""}
              onChange={(e) => setApiKeyValue(e.target.value)}
              placeholder={row.hasApiKey ? "•••••••••••••••• (leave blank to keep)" : "sk-…"}
              className={row.hasApiKey ? "pr-9" : undefined}
            />
            {row.hasApiKey && (
              <button
                type="button"
                onClick={toggleReveal}
                disabled={revealing}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
                title={visible ? "Hide" : "Reveal"}
              >
                {revealing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : visible ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Target Gateway API URL</Label>
          <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.provider.com/v1" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3.5">
        <div>
          <p className="text-sm font-semibold">Status</p>
          <p className="text-xs text-muted-foreground">Marks this provider active or disabled.</p>
        </div>
        <Switch
          checked={row.status === "Active"}
          onCheckedChange={(v) => update.mutate({ id: row.id, status: v ? "Active" : "Disabled" })}
          aria-label="Status"
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border p-3.5">
        <div>
          <p className="text-sm font-semibold">Automatic Failsafe Routing</p>
          <p className="text-xs text-muted-foreground">
            If this API throws a timeout error, fall back onto alternative providers.
          </p>
        </div>
        <Switch
          checked={row.autoFailover}
          onCheckedChange={(v) => update.mutate({ autoFailover: v, id: row.id })}
          aria-label="Automatic failsafe routing"
        />
      </div>

      <Button disabled={update.isPending} onClick={save}>
        {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
        Save and Deploy Configuration
      </Button>
    </div>
  );
}
