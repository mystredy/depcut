"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";

export function SiteInfoSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [appName, setAppName] = useState("");
  const [tagline, setTagline] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [description, setDescription] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setAppName(s.appName);
    setTagline(s.tagline ?? "");
    setWebsiteUrl(s.websiteUrl ?? "");
    setDescription(s.description ?? "");
    setSupportEmail(s.supportEmail ?? "");
    setContactEmail(s.contactEmail ?? "");
    setAdminEmail(s.adminEmail ?? "");
  }, [settings.data]);

  const save = () => {
    update.mutate({
      adminEmail,
      appName,
      contactEmail,
      description,
      supportEmail,
      tagline,
      websiteUrl,
    });
  };

  if (settings.isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Site Information</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The name and description used across the site, and where visitors reach you.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Website Name</Label>
          <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="A short line under the name"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Website URL</Label>
        <Input
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://depcut.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Used as the page description search engines and link previews show."
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Support Email</Label>
          <p className="text-xs text-muted-foreground">Shown to visitors — the marketing footer, &quot;need help&quot; links.</p>
          <Input
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contact Email</Label>
          <p className="text-xs text-muted-foreground">A general contact address, separate from support.</p>
          <Input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Primary Admin Notification Email</Label>
        <p className="text-xs text-muted-foreground">
          Internal only — never shown to visitors. Where system notifications go.
        </p>
        <Input
          type="email"
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
        />
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
