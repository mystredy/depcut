"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminSettings, useUpdateAdminSettings } from "@/queries/admin";
import type { SiteSocialLinks } from "@/queries/admin";

const SOCIAL_PLATFORMS: { key: keyof SiteSocialLinks; label: string; placeholder: string }[] = [
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@depcut" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@depcut" },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/depcut" },
  { key: "x", label: "X", placeholder: "https://x.com/depcut" },
  { key: "discord", label: "Discord", placeholder: "https://discord.gg/…" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/depcut" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/depcut" },
];

export function LegalLinksSection() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();

  const [termsUrl, setTermsUrl] = useState("");
  const [privacyUrl, setPrivacyUrl] = useState("");
  const [cookiePolicyUrl, setCookiePolicyUrl] = useState("");
  const [helpCenterUrl, setHelpCenterUrl] = useState("");
  const [socialLinks, setSocialLinks] = useState<SiteSocialLinks>({});

  useEffect(() => {
    if (!settings.data) return;
    const s = settings.data.settings;
    setTermsUrl(s.termsUrl ?? "");
    setPrivacyUrl(s.privacyUrl ?? "");
    setCookiePolicyUrl(s.cookiePolicyUrl ?? "");
    setHelpCenterUrl(s.helpCenterUrl ?? "");
    setSocialLinks(s.socialLinks ?? {});
  }, [settings.data]);

  const save = () => {
    // Blank fields drop out entirely rather than saving as empty strings,
    // so Footer.tsx's "only show what's set" filter has nothing to filter.
    const links = Object.fromEntries(
      Object.entries(socialLinks).filter(([, v]) => v && v.trim().length > 0)
    );
    update.mutate({ cookiePolicyUrl, helpCenterUrl, privacyUrl, socialLinks: links, termsUrl });
  };
  const dirty =
    !!settings.data &&
    (termsUrl !== (settings.data.settings.termsUrl ?? "") ||
      privacyUrl !== (settings.data.settings.privacyUrl ?? "") ||
      cookiePolicyUrl !== (settings.data.settings.cookiePolicyUrl ?? "") ||
      helpCenterUrl !== (settings.data.settings.helpCenterUrl ?? "") ||
      SOCIAL_PLATFORMS.some(
        ({ key }) => (socialLinks[key] ?? "") !== (settings.data!.settings.socialLinks?.[key] ?? "")
      ));

  if (settings.isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Legal &amp; Links</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Terms, Privacy, and Cookie Policy fall back to this site&apos;s own /terms and /privacy
          pages when left blank (Cookie Policy and Help Center only appear once set — there&apos;s
          no page of their own here).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Terms of Service URL</Label>
          <Input value={termsUrl} onChange={(e) => setTermsUrl(e.target.value)} placeholder="/terms" />
        </div>
        <div className="space-y-1.5">
          <Label>Privacy Policy URL</Label>
          <Input value={privacyUrl} onChange={(e) => setPrivacyUrl(e.target.value)} placeholder="/privacy" />
        </div>
        <div className="space-y-1.5">
          <Label>Cookie Policy URL</Label>
          <Input value={cookiePolicyUrl} onChange={(e) => setCookiePolicyUrl(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Documentation / Help Center URL</Label>
          <Input value={helpCenterUrl} onChange={(e) => setHelpCenterUrl(e.target.value)} />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold">Social Links</p>
        <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
          Only platforms with a link render in the marketing footer.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map(({ key, label, placeholder }) => (
            <div key={key} className="space-y-1.5">
              <Label>{label}</Label>
              <Input
                value={socialLinks[key] ?? ""}
                onChange={(e) => setSocialLinks((cur) => ({ ...cur, [key]: e.target.value }))}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
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
