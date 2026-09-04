"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";
import type { PublicSiteSettings } from "@/lib/siteSettings";

export const publicSiteSettingsQueryKey = ["site", "settings"] as const;

/** The public half of admin/settings/general (see lib/siteSettings.ts), for
 * a client component with no server-render path of its own — the beta
 * badge, the marketing Footer. A server component reads publicSiteSettings()
 * directly instead; this is the client-side twin of that same read. */
export function usePublicSiteSettings() {
  return useQuery({
    queryFn: () => apiFetch<{ settings: PublicSiteSettings }>("/api/site/settings"),
    queryKey: publicSiteSettingsQueryKey,
    staleTime: 60_000,
  });
}
