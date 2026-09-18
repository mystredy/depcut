"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";
import { payoutQueryKey } from "@/queries/payouts";

export const artistRatesQueryKey = ["artist", "rates"] as const;

export type ArtistRates = {
  available: number;
  pending: number;
  lifetime: number;
  // Current 1-Rate-to-USD conversion (admin-set, see FinanceExchangeRate) —
  // for display context and the move-to-payout preview; the real
  // conversion happens at move time, not here.
  usdPerRate: number;
};

// The signed-in creator's own Artist Earnings wallet: available (cleared
// the bi-weekly sweep, eligible to move to Payout — not itself
// withdrawable), pending (earned, waiting on artistRatesSweep.ts), and
// lifetime (total ever earned).
export function useArtistRates() {
  return useQuery({
    queryFn: () => apiFetch<ArtistRates>("/api/artist/rates"),
    queryKey: artistRatesQueryKey,
  });
}

// Moves `rates` Rates out of Artist Earnings and into the Payout wallet,
// converting at the current exchange rate. Invalidates both wallets —
// this is the one action that touches both.
export function useMoveRatesToPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rates: number) =>
      apiFetch<{ movedRates: number; movedUsd: number }>("/api/artist/rates/move-to-payout", {
        body: JSON.stringify({ rates }),
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: artistRatesQueryKey });
      void queryClient.invalidateQueries({ queryKey: payoutQueryKey });
    },
  });
}
