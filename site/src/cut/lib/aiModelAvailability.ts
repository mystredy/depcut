"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/queries/apiClient";

// Which chat/image/video model tiers an admin has actually left enabled
// (/admin/settings/ai-models) — read by the video and image generate
// composers to keep their pickers in sync with what's really on offer.

type EnabledAiModel = { modality: "chat" | "image" | "video"; tier: string; enabled: boolean };

const queryKey = ["ai-models", "enabled"] as const;

/** The enabled tiers for one modality, or null while the first fetch is still
 * in flight — callers should hold off filtering until this resolves, so a
 * cold load doesn't flash an unfiltered list and then shrink it. */
function useEnabledTiers(modality: "image" | "video"): Set<string> | null {
  const { data } = useQuery({
    queryFn: () => apiFetch<{ models: EnabledAiModel[] }>("/api/ai-models"),
    queryKey,
    staleTime: 5 * 60 * 1000,
  });
  if (!data) return null;
  return new Set(data.models.filter((m) => m.modality === modality && m.enabled).map((m) => m.tier));
}

/** A registry list narrowed to admin-enabled tiers. Falls back to the full,
 * unfiltered list while loading, or if an admin has left nothing enabled for
 * this modality — a picker should never end up with zero options. */
export function useSelectableModels<T extends { tier: string }>(
  modality: "image" | "video",
  all: readonly T[]
): T[] {
  const enabledTiers = useEnabledTiers(modality);
  if (!enabledTiers) return [...all];
  const selectable = all.filter((m) => enabledTiers.has(m.tier));
  return selectable.length > 0 ? selectable : [...all];
}
