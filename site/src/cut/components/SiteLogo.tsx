"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_LOGO = "/deepw-logo.svg";

/** One theme's mark: the admin-uploaded logo (admin/settings/general) for
 * `theme`, falling back to the bundled default the moment that request
 * fails — an unset upload 404s immediately, so there's no visible gap. */
function ThemedMark({ theme, alt }: { theme: "light" | "dark"; alt: string }) {
  const [src, setSrc] = useState(`/api/site/logo/${theme}`);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn(
        "absolute inset-0 h-full w-full object-contain",
        theme === "light" ? "dark:hidden" : "hidden dark:block"
      )}
      onError={() => setSrc((s) => (s === DEFAULT_LOGO ? s : DEFAULT_LOGO))}
    />
  );
}

/** Drop-in replacement for a fixed-size `<img src="/deepw-logo.svg">`: shows
 * whichever logo the admin uploaded for the active theme (light or dark),
 * falling back to the bundled default wherever a theme has no upload of its
 * own. Renders both variants and lets CSS pick one (the `dark` class on
 * `<html>`, same as everywhere else in the app), so there's no flash of the
 * wrong logo before a theme resolves the way reading `useTheme()` on mount
 * would cost. */
export function SiteLogo({
  alt = "DepCut",
  width,
  height,
  className,
}: {
  alt?: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ height, width }}
    >
      <ThemedMark alt={alt} theme="light" />
      <ThemedMark alt={alt} theme="dark" />
    </span>
  );
}
