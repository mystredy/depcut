"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

const LOCALES = ["en-US", "es-ES", "fr-FR", "de-DE"];
const TIMEZONES = ["America/Los_Angeles", "UTC", "Europe/London", "Asia/Tokyo"];

export default function AdminGeneralSettingsPage() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [appName, setAppName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [defaultLocale, setDefaultLocale] = useState(LOCALES[0]);
  const [timezone, setTimezone] = useState(TIMEZONES[0]);

  useEffect(() => {
    if (!settings.data) return;
    setAppName(settings.data.settings.appName);
    setAdminEmail(settings.data.settings.adminEmail ?? "");
    setDefaultLocale(settings.data.settings.defaultLocale);
    setTimezone(settings.data.settings.timezone);
  }, [settings.data]);

  const save = () => {
    update.mutate({ adminEmail, appName, defaultLocale, timezone });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">General Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brand identity, admin contact, and default locale for the whole site.
        </p>
      </div>

      {settings.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : settings.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>
      ) : (
        <div className="max-w-2xl space-y-4 rounded-2xl border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Brand Identity Name</Label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Primary Admin Notification Email</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Default Locale / Language</Label>
              <select
                value={defaultLocale}
                onChange={(e) => setDefaultLocale(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                {LOCALES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>System Timezone</Label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
              >
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button disabled={update.isPending} onClick={save}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
