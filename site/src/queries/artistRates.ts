"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const artistRatesQueryKey = ["artist", "rates"] as const;

export type ArtistRates = {
  available: number;
  pending: number;
  lifetime: number;
  // Current 1-Rate-to-USD conversion (admin-set, see FinanceExchangeRate) —
  // for display context only; the real conversion happens at withdrawal time.
  usdPerRate: number;
};

// The signed-in creator's own Rates wallet: available (cash-out eligible),
// pending (earned, waiting on artistRatesSweep.ts's bi-weekly cycle), and
// lifetime (total ever earned).
export function useArtistRates() {
  return useQuery({
    queryFn: () => apiFetch<ArtistRates>("/api/artist/rates"),
    queryKey: artistRatesQueryKey,
  });
}
