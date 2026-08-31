"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

// The unified Image & Video feature's client data layer — a "Flow" is a
// server-persisted creative thread (see prisma/GenerationFlows.prisma and
// lib/flows/*.ts). Every hook here talks to /api/flows/*.

export type FlowSummary = {
  id: string;
  name: string;
  coverUrl: string | null;
  hasImage: boolean;
  hasVideo: boolean;
  processing: boolean;
  updatedAt: string;
};

export type FlowGeneration = {
  id: string;
  kind: "image" | "video";
  prompt: string;
  provider: string;
  model: string;
  parameters: Record<string, unknown>;
  refMode: string | null;
  status: "in_progress" | "completed" | "failed";
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
};

export type FlowDetail = { flow: { id: string; name: string }; generations: FlowGeneration[] };

export const flowsQueryKey = ["flows"] as const;
export const flowQueryKey = (id: string) => ["flows", id] as const;

export function useFlows() {
  return useQuery({
    queryFn: () => apiFetch<{ flows: FlowSummary[] }>("/api/flows"),
    queryKey: flowsQueryKey,
    // A processing generation needs the gallery to notice it landed even
    // when the user isn't inside that thread — cheap enough at gallery scale.
    refetchInterval: (query) => (query.state.data?.flows.some((f) => f.processing) ? 5000 : false),
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) =>
      apiFetch<{ flow: { id: string; name: string } }>("/api/flows", {
        body: JSON.stringify(name ? { name } : {}),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flowsQueryKey }),
  });
}

export function useFlow(id: string | null) {
  return useQuery({
    enabled: id !== null,
    queryFn: () => apiFetch<FlowDetail>(`/api/flows/${id}`),
    queryKey: flowQueryKey(id ?? ""),
  });
}

export function useRenameFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      apiFetch(`/api/flows/${id}`, { body: JSON.stringify({ name }), method: "PATCH" }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: flowsQueryKey });
      queryClient.invalidateQueries({ queryKey: flowQueryKey(id) });
    },
  });
}

export function useSetFlowCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, coverKey }: { id: string; coverKey: string }) =>
      apiFetch(`/api/flows/${id}`, { body: JSON.stringify({ coverKey }), method: "PATCH" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flowsQueryKey }),
  });
}

export function useDuplicateFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ flow: { id: string } }>(`/api/flows/${id}/duplicate`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flowsQueryKey }),
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/flows/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flowsQueryKey }),
  });
}

export type CreateGenerationInput = {
  kind: "image" | "video";
  prompt: string;
  /** Optional — image resolves its provider from the model id alone. */
  provider?: string;
  model: string;
  tier: string;
  refMode?: string;
  inputs?: Record<string, unknown>;
  parameters?: Record<string, unknown>;
};

export function useCreateGeneration(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGenerationInput) =>
      apiFetch<{ id: string; status: "in_progress" | "completed" | "failed" }>(
        `/api/flows/${flowId}/generations`,
        { body: JSON.stringify(input), method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKey(flowId) });
      queryClient.invalidateQueries({ queryKey: flowsQueryKey });
    },
  });
}

export function useDeleteGeneration(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (genId: string) => apiFetch(`/api/flows/${flowId}/generations/${genId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKey(flowId) });
      queryClient.invalidateQueries({ queryKey: flowsQueryKey });
    },
  });
}

/** One poll of an in-flight generation — the thread page calls this on a
 * timer for any row still "in_progress" rather than wrapping it as a
 * mutation, since it's a background tick, not a user action. */
export async function refreshGeneration(
  flowId: string,
  genId: string
): Promise<{ status: "in_progress" | "completed" | "failed" }> {
  return apiFetch(`/api/flows/${flowId}/generations/${genId}/refresh`, { method: "POST" });
}
