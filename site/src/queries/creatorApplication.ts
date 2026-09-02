"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type CreatorApplication = {
  userId: string;
  reason: string;
  portfolio: string | null;
  status: "Pending" | "Approved" | "Rejected";
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

const myCreatorApplicationQueryKey = ["creator-application", "me"] as const;

export function useMyCreatorApplication() {
  return useQuery({
    queryFn: () => apiFetch<{ application: CreatorApplication | null }>("/api/creator-applications/me"),
    queryKey: myCreatorApplicationQueryKey,
  });
}

export function useSubmitCreatorApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string; portfolio?: string }) =>
      apiFetch<{ application: CreatorApplication }>("/api/creator-applications/me", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: myCreatorApplicationQueryKey }),
  });
}
