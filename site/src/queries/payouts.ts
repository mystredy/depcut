"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const payoutQueryKey = ["payouts", "balance"] as const;

export type PayoutWithdrawal = {
  id: string;
  amountRequested: number;
  finalAmount: number;
  method: string;
  destination: string;
  status: string;
  createdAt: string;
};

export type PayoutBalance = {
  available: number;
  lifetime: number;
  // Sum of finalAmount across every "Paid" withdrawal — what's actually
  // left the platform, not just been requested.
  totalWithdrawn: number;
  withdrawals: PayoutWithdrawal[];
};

// The signed-in creator's own Payout (USD) wallet — separate from
// useArtistRates. This is the only balance a real Withdrawal draws down.
export function usePayoutBalance() {
  return useQuery({
    queryFn: () => apiFetch<PayoutBalance>("/api/payouts"),
    queryKey: payoutQueryKey,
  });
}
