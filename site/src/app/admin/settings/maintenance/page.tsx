"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export default function AdminMaintenancePage() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [header, setHeader] = useState("");
  const [paragraph, setParagraph] = useState("");
  const [footer, setFooter] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    setMaintenanceMode(settings.data.settings.maintenanceMode);
    setHeader(settings.data.settings.maintenanceHeader ?? "");
    setParagraph(settings.data.settings.maintenanceParagraph ?? "");
    setFooter(settings.data.settings.maintenanceFooter ?? "");
  }, [settings.data]);

  const save = () => {
    update.mutate({
      maintenanceFooter: footer,
      maintenanceHeader: header,
      maintenanceMode,
      maintenanceParagraph: paragraph,
    });
  };
  const dirty =
    !!settings.data &&
    (maintenanceMode !== settings.data.settings.maintenanceMode ||
      header !== (settings.data.settings.maintenanceHeader ?? "") ||
      paragraph !== (settings.data.settings.maintenanceParagraph ?? "") ||
      footer !== (settings.data.settings.maintenanceFooter ?? ""));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Maintenance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          When maintenance mode is on, visitors see this message instead of the site.
        </p>
      </div>

      {settings.isLoading ? (
        <Skeleton className="h-80 w-full max-w-2xl" />
      ) : settings.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>
      ) : (
        <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-semibold">Maintenance Mode</p>
              <p className="text-xs text-muted-foreground">
                Turning this on closes the site to visitors.
              </p>
            </div>
            <Switch
              checked={maintenanceMode}
              onCheckedChange={setMaintenanceMode}
              aria-label="Maintenance mode"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Header</Label>
            <Input value={header} onChange={(e) => setHeader(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Paragraph</Label>
            <Textarea value={paragraph} onChange={(e) => setParagraph(e.target.value)} rows={4} />
          </div>

          <div className="space-y-1.5">
            <Label>Footer</Label>
            <Input value={footer} onChange={(e) => setFooter(e.target.value)} />
            <p className="text-xs text-muted-foreground">HTML is allowed here.</p>
          </div>

          <div className="flex justify-end pt-2">
            <Button disabled={update.isPending || !dirty} onClick={save}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
