"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_LOGO = "/deepw-logo.svg";

/** Fallback chain for one theme's mark: the compact/icon logo first when one
 * was asked for (there's no theme split of its own — see SiteLogo's doc
 * comment), then the theme's own upload, then the bundled default. Each
 * entry is tried in order as the one before it 404s. */
function sourcesFor(theme: "light" | "dark", compact: boolean): string[] {
  return compact
    ? [`/api/site/logo/compact`, `/api/site/logo/${theme}`, DEFAULT_LOGO]
    : [`/api/site/logo/${theme}`, DEFAULT_LOGO];
}

/** One theme's mark, advancing through its fallback chain as each source
 * 404s — an unset upload fails immediately, so there's no visible gap. */
function ThemedMark({ theme, alt, compact }: { theme: "light" | "dark"; alt: string; compact: boolean }) {
  const sources = sourcesFor(theme, compact);
  const [step, setStep] = useState(0);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded bytes, not a Next-optimizable asset
    <img
      src={sources[step]}
      alt={alt}
      draggable={false}
      className={cn(
        "absolute inset-0 h-full w-full object-contain",
        theme === "light" ? "dark:hidden" : "hidden dark:block"
      )}
      onError={() => setStep((s) => Math.min(s + 1, sources.length - 1))}
    />
  );
}

/** Drop-in replacement for a fixed-size `<img src="/deepw-logo.svg">`: shows
 * whichever logo the admin uploaded for the active theme (light or dark),
 * falling back to the bundled default wherever a theme has no upload of its
 * own. Renders both variants and lets CSS pick one (the `dark` class on
 * `<html>`, same as everywhere else in the app), so there's no flash of the
 * wrong logo before a theme resolves the way reading `useTheme()` on mount
 * would cost.
 *
 * `compact`: the collapsed-sidebar / mobile mark (admin/settings/general's
 * Logo Icon). One image, no light/dark split of its own — set `compact` and
 * this tries it first, ahead of the theme pair, for either theme. */
export function SiteLogo({
  alt = "DepCut",
  width,
  height,
  className,
  compact = false,
}: {
  alt?: string;
  width: number;
  height: number;
  className?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={cn("relative inline-block shrink-0", className)}
      style={{ height, width }}
    >
      <ThemedMark alt={alt} compact={compact} theme="light" />
      <ThemedMark alt={alt} compact={compact} theme="dark" />
    </span>
  );
}
