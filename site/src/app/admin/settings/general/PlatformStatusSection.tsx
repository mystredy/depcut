"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export function PlatformStatusSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [betaMode, setBetaMode] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setBetaMode(settings.data.settings.betaMode);
  }, [settings.data]);

  const save = () => update.mutate({ betaMode });
  const dirty = !!settings.data && betaMode !== settings.data.settings.betaMode;

  if (settings.isLoading) return <Skeleton className="h-32 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Platform Status</h2>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="text-sm font-semibold">Beta Mode</p>
          <p className="text-xs text-muted-foreground">
            Shows a small Beta badge beside the logo across the app and the marketing site.
          </p>
        </div>
        <Switch checked={betaMode} onCheckedChange={setBetaMode} aria-label="Beta mode" />
      </div>
      <div className="flex justify-end pt-2">
        <Button disabled={update.isPending || !dirty} onClick={save}>
          {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          Save
        </Button>
      </div>
    </div>
  );
}
