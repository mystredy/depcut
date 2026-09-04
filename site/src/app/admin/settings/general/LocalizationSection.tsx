"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

const LOCALES = ["en-US", "es-ES", "fr-FR", "de-DE"];
const TIMEZONES = ["America/Los_Angeles", "UTC", "Europe/London", "Asia/Tokyo"];
const DATE_FORMATS = [
  { label: "MM/DD/YYYY (09/04/2026)", value: "MM/DD/YYYY" },
  { label: "DD/MM/YYYY (04/09/2026)", value: "DD/MM/YYYY" },
  { label: "YYYY-MM-DD (2026-09-04)", value: "YYYY-MM-DD" },
];
const TIME_FORMATS = [
  { label: "12-hour (2:30 PM)", value: "12h" },
  { label: "24-hour (14:30)", value: "24h" },
];

const selectClass =
  "w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring";

export function LocalizationSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [defaultLocale, setDefaultLocale] = useState(LOCALES[0]);
  const [timezone, setTimezone] = useState(TIMEZONES[0]);
  const [dateFormat, setDateFormat] = useState(DATE_FORMATS[0].value);
  const [timeFormat, setTimeFormat] = useState(TIME_FORMATS[0].value);

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setDefaultLocale(s.defaultLocale);
    setTimezone(s.timezone);
    setDateFormat(s.dateFormat);
    setTimeFormat(s.timeFormat);
  }, [settings.data]);

  const save = () => {
    update.mutate({
      dateFormat: dateFormat as "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD",
      defaultLocale,
      timeFormat: timeFormat as "12h" | "24h",
      timezone,
    });
  };

  if (settings.isLoading) return <Skeleton className="h-64 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Localization</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Defaults for a visitor who hasn't picked their own. Used by
          admin/settings/general's own date and time columns (see
          site/src/lib/siteDateFormat.ts) — the rest of the admin panel's
          date displays haven't all been swept onto it yet.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Default Language</Label>
          <select
            value={defaultLocale}
            onChange={(e) => setDefaultLocale(e.target.value)}
            className={selectClass}
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
            className={selectClass}
          >
            {TIMEZONES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date Format</Label>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            className={selectClass}
          >
            {DATE_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Time Format</Label>
          <select
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value)}
            className={selectClass}
          >
            {TIME_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
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
  );
}
