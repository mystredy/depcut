"use client";

import { usePublicSiteSettings } from "@/queries/site";
import { cn } from "@/lib/utils";

/** admin/settings/general's Beta Mode toggle: a small pill next to the logo
 * wherever the wordmark shows, silent (renders nothing) until the setting
 * loads and whenever it's off. */
export function BetaBadge({ className }: { className?: string }) {
  const { data } = usePublicSiteSettings();
  if (!data?.settings.betaMode) return null;
  return (
    <span
      className={cn(
        "rounded-full border border-current/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase",
        className
      )}
    >
      Beta
    </span>
  );
}
