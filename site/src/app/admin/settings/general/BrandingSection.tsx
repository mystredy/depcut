"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdminSettings,
  useRemoveAppleTouchIcon,
  useRemoveFavicon,
  useRemoveSiteLogo,
  useRemoveSocialShareImage,
  useUpdateAdminSettings,
  useUploadAppleTouchIcon,
  useUploadFavicon,
  useUploadSiteLogo,
  useUploadSocialShareImage,
} from "@/queries/admin";

type Slot = {
  label: string;
  hint: string;
  previewSrc: string;
  accept: string;
  maxBytes: number;
  typeError: string;
  upload: (file: File) => Promise<unknown>;
  remove: () => Promise<unknown>;
  uploading: boolean;
  removing: boolean;
};

// One upload slot: a checkerboard preview (so a transparent logo shows as
// transparent, not black), Upload/Replace, and Remove once something is
// there. Existence is read off the preview image itself — it 404s when
// nothing's uploaded — rather than a flag from the settings payload, which
// deliberately never carries these bytes (see the /api/admin/settings
// route's OMIT_BRANDING_BYTES).
function BrandAssetSlot({
  label,
  hint,
  previewSrc,
  accept,
  maxBytes,
  typeError,
  upload,
  remove,
  uploading,
  removing,
}: Slot) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [bust, setBust] = useState(0);
  const [exists, setExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = uploading || removing;

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type || !accept.split(",").includes(file.type)) {
      setError(typeError);
      return;
    }
    if (file.size > maxBytes) {
      setError(`That file is too large (max ${Math.round(maxBytes / 1024)}KB).`);
      return;
    }
    try {
      await upload(file);
      setBust((n) => n + 1);
      setExists(true);
    } catch {
      setError("Couldn't save that image — try again.");
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <div className="flex items-center gap-3">
        <div
          className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#00000014_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]"
        >
          {exists === false ? (
            <ImageUp className="size-5 text-muted-foreground/50" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
            <img
              src={bust ? `${previewSrc}?v=${bust}` : previewSrc}
              alt=""
              className="size-full object-contain"
              onLoad={() => setExists(true)}
              onError={() => setExists(false)}
            />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
              ) : null}
              {exists ? "Replace" : "Upload"}
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={accept}
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {exists && (
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={async () => {
                  setError(null);
                  try {
                    await remove();
                    setBust((n) => n + 1);
                    setExists(false);
                  } catch {
                    setError("Couldn't remove that image — try again.");
                  }
                }}
              >
                {removing ? (
                  <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                ) : (
                  <Trash2 className="size-3.5" data-icon="inline-start" />
                )}
                Remove
              </Button>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    </div>
  );
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Overrides --primary site-wide (see app/layout.tsx) the moment it's saved —
// a plain PATCH through the same general-settings mutation everything else
// on this page uses, not an upload.
function AccentColorField() {
  const settings = useAdminSettings();
  const update = useUpdateAdminSettings();
  const [hex, setHex] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setHex(settings.data.settings.accentColor ?? "");
  }, [settings.data]);

  const save = (next: string) => {
    setHex(next);
    if (next !== "" && !HEX_RE.test(next)) {
      setError("Use a 6-digit hex color, like #7C5CFA.");
      return;
    }
    setError(null);
    update.mutate({ accentColor: next });
  };

  return (
    <div className="space-y-1.5">
      <Label>Brand / Accent Color</Label>
      <p className="text-xs text-muted-foreground">
        Overrides the primary color used across the signed-in app.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(hex) ? hex : "#7c5cfa"}
          onChange={(e) => save(e.target.value)}
          className="size-9 cursor-pointer rounded-lg border border-input bg-transparent p-0.5"
          aria-label="Accent color picker"
        />
        <Input
          value={hex}
          onChange={(e) => save(e.target.value)}
          placeholder="#7C5CFA"
          className="w-32 font-mono"
        />
        {hex && (
          <Button variant="outline" size="sm" onClick={() => save("")}>
            <Trash2 className="size-3.5" data-icon="inline-start" />
            Clear
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

const LOGO_TYPES = "image/svg+xml,image/png,image/webp";
const LOGO_MAX_BYTES = 1024 * 1024;

export function BrandingSection() {
  const uploadLight = useUploadSiteLogo("light");
  const removeLight = useRemoveSiteLogo("light");
  const uploadDark = useUploadSiteLogo("dark");
  const removeDark = useRemoveSiteLogo("dark");
  const uploadCompact = useUploadSiteLogo("compact");
  const removeCompact = useRemoveSiteLogo("compact");
  const uploadFavicon = useUploadFavicon();
  const removeFavicon = useRemoveFavicon();
  const uploadAppleTouchIcon = useUploadAppleTouchIcon();
  const removeAppleTouchIcon = useRemoveAppleTouchIcon();
  const uploadSocialShareImage = useUploadSocialShareImage();
  const removeSocialShareImage = useRemoveSocialShareImage();

  const settings = useAdminSettings();
  if (settings.isLoading) return <Skeleton className="h-96 w-full max-w-2xl" />;
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load settings. Try again.</p>;
  }

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Branding</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Every image here falls back to its bundled default the moment it&apos;s removed.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <BrandAssetSlot
          label="Logo — light theme"
          hint="Shown when the app is in light mode. SVG, PNG, or WebP."
          previewSrc="/api/site/logo/light"
          accept={LOGO_TYPES}
          maxBytes={LOGO_MAX_BYTES}
          typeError="Logos must be SVG, PNG, or WebP."
          upload={(file) => uploadLight.mutateAsync(file)}
          remove={() => removeLight.mutateAsync()}
          uploading={uploadLight.isPending}
          removing={removeLight.isPending}
        />
        <BrandAssetSlot
          label="Logo — dark theme"
          hint="Shown when the app is in dark mode. SVG, PNG, or WebP."
          previewSrc="/api/site/logo/dark"
          accept={LOGO_TYPES}
          maxBytes={LOGO_MAX_BYTES}
          typeError="Logos must be SVG, PNG, or WebP."
          upload={(file) => uploadDark.mutateAsync(file)}
          remove={() => removeDark.mutateAsync()}
          uploading={uploadDark.isPending}
          removing={removeDark.isPending}
        />
        <BrandAssetSlot
          label="Logo Icon / Compact"
          hint="Used in the collapsed sidebar and small icon spots. Falls back to the theme logo above when unset."
          previewSrc="/api/site/logo/compact"
          accept={LOGO_TYPES}
          maxBytes={LOGO_MAX_BYTES}
          typeError="Logos must be SVG, PNG, or WebP."
          upload={(file) => uploadCompact.mutateAsync(file)}
          remove={() => removeCompact.mutateAsync()}
          uploading={uploadCompact.isPending}
          removing={removeCompact.isPending}
        />
        <BrandAssetSlot
          label="Favicon"
          hint="The browser tab icon. PNG only, ideally square."
          previewSrc="/icon"
          accept="image/png"
          maxBytes={256 * 1024}
          typeError="Favicons must be a PNG image."
          upload={(file) => uploadFavicon.mutateAsync(file)}
          remove={() => removeFavicon.mutateAsync()}
          uploading={uploadFavicon.isPending}
          removing={removeFavicon.isPending}
        />
        <BrandAssetSlot
          label="Apple Touch Icon"
          hint="Shown when someone saves the site to an iPhone/iPad home screen. PNG only."
          previewSrc="/apple-icon"
          accept="image/png"
          maxBytes={512 * 1024}
          typeError="The apple touch icon must be a PNG image."
          upload={(file) => uploadAppleTouchIcon.mutateAsync(file)}
          remove={() => removeAppleTouchIcon.mutateAsync()}
          uploading={uploadAppleTouchIcon.isPending}
          removing={removeAppleTouchIcon.isPending}
        />
        <BrandAssetSlot
          label="Default Social Share Image"
          hint="Shown when a link to this site is shared on WhatsApp, X, Facebook, Discord, etc. PNG or JPEG, 1200×630 works best."
          previewSrc="/opengraph-image"
          accept="image/png,image/jpeg"
          maxBytes={2 * 1024 * 1024}
          typeError="The social share image must be a PNG or JPEG image."
          upload={(file) => uploadSocialShareImage.mutateAsync(file)}
          remove={() => removeSocialShareImage.mutateAsync()}
          uploading={uploadSocialShareImage.isPending}
          removing={removeSocialShareImage.isPending}
        />
      </div>
      <AccentColorField />
    </div>
  );
}
