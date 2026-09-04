"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

const THEMES = [
  { label: "Light", value: "light" },
  { label: "Dark", value: "dark" },
  { label: "System", value: "system" },
];

export function AppearanceSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [defaultTheme, setDefaultTheme] = useState("system");

  useEffect(() => {
    if (!settings.data) return;
    setDefaultTheme(settings.data.settings.defaultTheme);
  }, [settings.data]);

  const save = () => {
    update.mutate({ defaultTheme: defaultTheme as "light" | "dark" | "system" });
  };

  if (settings.isLoading) return <Skeleton className="h-40 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Appearance</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The theme a visitor with no stored preference of their own gets. Anyone who has
          already picked light, dark, or system for themselves keeps that choice regardless.
        </p>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label>Default Theme</Label>
        <select
          value={defaultTheme}
          onChange={(e) => setDefaultTheme(e.target.value)}
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
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
