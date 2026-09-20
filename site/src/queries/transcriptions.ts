"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type TranscriptionHistoryEntry = {
  id: string;
  sourceType: string;
  sourceLabel: string;
  status: string;
  transcript: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const transcriptionHistoryQueryKey = ["transcription-history"] as const;

// The signed-in user's durable Speech to Text history — every run counted
// here regardless of whether it came from this page or the Telegram bot's
// Transcript button (both write through the same server-side call).
export function useTranscriptionHistory() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ transcriptions: TranscriptionHistoryEntry[] }>("/api/transcriptions"),
    queryKey: transcriptionHistoryQueryKey,
  });
}

export function useDeleteTranscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/transcriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: transcriptionHistoryQueryKey }),
  });
}
