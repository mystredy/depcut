"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type AffiliateReferral = {
  id: string;
  referredUserName: string;
  referredUserImage: string | null;
  commissionRates: number;
  createdAt: string;
};

export type MyAffiliate = {
  code: string;
  createdAt: string;
  referrals: AffiliateReferral[];
};

export type MyAffiliateResponse = {
  affiliate: MyAffiliate | null;
  commissionRatePerSignup: number;
  stats: {
    referralCount: number;
    totalCommissionRates: number;
    totalCommissionUsd: number;
  };
};

const myAffiliateQueryKey = ["affiliate", "me"] as const;

export function useMyAffiliate() {
  return useQuery({
    queryFn: () => apiFetch<MyAffiliateResponse>("/api/affiliate/me"),
    queryKey: myAffiliateQueryKey,
  });
}

export function useJoinAffiliateProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ affiliate: MyAffiliate }>("/api/affiliate/me", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myAffiliateQueryKey }),
  });
}
