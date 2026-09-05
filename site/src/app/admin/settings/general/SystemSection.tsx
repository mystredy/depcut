"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export function SystemSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [copyrightText, setCopyrightText] = useState("");
  const [footerText, setFooterText] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setMaintenanceMode(s.maintenanceMode);
    setCopyrightText(s.copyrightText ?? "");
    setFooterText(s.footerText ?? "");
  }, [settings.data]);

  const save = () => {
    update.mutate({ copyrightText, footerText, maintenanceMode });
  };
  const dirty =
    !!settings.data &&
    (maintenanceMode !== settings.data.settings.maintenanceMode ||
      copyrightText !== (settings.data.settings.copyrightText ?? "") ||
      footerText !== (settings.data.settings.footerText ?? ""));

  if (settings.isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">System</h2>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div>
          <p className="text-sm font-semibold">Maintenance Mode</p>
          <p className="text-xs text-muted-foreground">
            Closes the site to visitors — enforced at the edge (proxy.ts), not just a banner.
            Admins keep access to /admin and /sign-in either way. Set the message visitors
            see on the{" "}
            <Link href="/admin/settings/maintenance" className="underline underline-offset-2">
              Maintenance page
            </Link>
            .
          </p>
        </div>
        <Switch
          checked={maintenanceMode}
          onCheckedChange={setMaintenanceMode}
          aria-label="Maintenance mode"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Copyright Text</Label>
        <Input
          value={copyrightText}
          onChange={(e) => setCopyrightText(e.target.value)}
          placeholder="© 2026 DepCut, Inc."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Footer Text</Label>
        <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} />
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
