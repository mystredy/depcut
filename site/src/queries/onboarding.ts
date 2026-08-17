"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ONBOARDING_VERSION, type ReferralSource } from "@/lib/onboarding/sequence";
import {
  ONBOARDING_SLIDE_DEFAULTS,
  type OnboardingSlideSlug,
} from "@/lib/onboarding/slide-copy-seed";
import { apiFetch } from "@/queries/apiClient";

export const onboardingQueryKey = ["account-onboarding"] as const;

export type OnboardingState = {
  version: number;
  completedAt: string | null;
  skipped: boolean;
  referralSources: string[];
};

type OnboardingUpdate =
  | { referralSources: ReferralSource[] }
  | { completed: true; skipped: boolean };

/** Whether this account still owes us a run of the current sequence. */
export function needsOnboarding(state: OnboardingState | undefined): boolean {
  if (!state) return false;
  return state.completedAt === null || state.version < ONBOARDING_VERSION;
}

export function useOnboardingState() {
  return useQuery({
    queryFn: () => apiFetch<OnboardingState>("/api/account/onboarding"),
    queryKey: onboardingQueryKey,
    // The sequence decides once per load whether to open; refetching behind an
    // open overlay could only close it mid-run.
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useSaveOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: OnboardingUpdate) =>
      apiFetch<OnboardingState>("/api/account/onboarding", {
        body: JSON.stringify(update),
        method: "PUT",
      }),
    onSuccess: (state) => {
      queryClient.setQueryData(onboardingQueryKey, state);
    },
  });
}

export type OnboardingSlideCopy = {
  id: string;
  slug: string;
  headline: string | null;
  body: string;
  updatedAt: string;
};

export const onboardingSlideCopyQueryKey = ["onboarding-slide-copy"] as const;

// The welcome sequence's editable headline/body text, admin-managed from
// /admin/onboarding. Public read — see src/app/api/onboarding/slides.
export function useOnboardingSlideCopy() {
  return useQuery({
    queryFn: () => apiFetch<{ slides: OnboardingSlideCopy[] }>("/api/onboarding/slides"),
    queryKey: onboardingSlideCopyQueryKey,
    staleTime: 5 * 60 * 1000,
  });
}

// A single slide's headline/body, falling back to the original hardcoded
// copy until the fetch lands (or if it fails) so a slide never renders
// blank.
export function useOnboardingSlideText(slug: OnboardingSlideSlug) {
  const { data } = useOnboardingSlideCopy();
  const row = data?.slides.find((s) => s.slug === slug);
  return row ? { body: row.body, headline: row.headline } : ONBOARDING_SLIDE_DEFAULTS[slug];
}
