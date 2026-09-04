"use client";

import { useRef, useState } from "react";
import { ImageUp, Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  useRemoveFavicon,
  useRemoveSiteLogo,
  useUploadFavicon,
  useUploadSiteLogo,
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

const LOGO_TYPES = "image/svg+xml,image/png,image/webp";
const LOGO_MAX_BYTES = 1024 * 1024;

export function BrandingSection() {
  const uploadLight = useUploadSiteLogo("light");
  const removeLight = useRemoveSiteLogo("light");
  const uploadDark = useUploadSiteLogo("dark");
  const removeDark = useRemoveSiteLogo("dark");
  const uploadFavicon = useUploadFavicon();
  const removeFavicon = useRemoveFavicon();

  return (
    <div className="max-w-2xl space-y-5 rounded-2xl border bg-card p-6">
      <div>
        <h2 className="text-sm font-semibold">Branding</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The logo shown across the signed-in app, and the browser tab icon. Each falls
          back to the default the moment it&apos;s removed.
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
      </div>
      <BrandAssetSlot
        label="Favicon"
        hint="The browser tab icon, and the home-screen icon on iOS. PNG only, ideally square."
        previewSrc="/icon"
        accept="image/png"
        maxBytes={256 * 1024}
        typeError="Favicons must be a PNG image."
        upload={(file) => uploadFavicon.mutateAsync(file)}
        remove={() => removeFavicon.mutateAsync()}
        uploading={uploadFavicon.isPending}
        removing={removeFavicon.isPending}
      />
    </div>
  );
}
