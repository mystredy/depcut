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
  hasFavorite: boolean;
  processing: boolean;
  updatedAt: string;
};

export type FlowGalleryFilters = {
  q?: string;
  kind?: "image" | "video";
  favoritesOnly?: boolean;
};

export type FlowGeneration = {
  id: string;
  kind: "image" | "video";
  prompt: string;
  name: string | null;
  favorite: boolean;
  provider: string;
  model: string;
  parameters: Record<string, unknown>;
  refMode: string | null;
  parentGenerationId: string | null;
  status: "in_progress" | "completed" | "failed";
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  posterUrl: string | null;
  /** The reference images actually sent with this submission, persisted to
   * R2 at submit time — never re-derived from the live ref, which may since
   * have changed or been deleted. Empty for a generation with no references
   * or one submitted before persistence existed. */
  referenceUrls: string[];
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  createdAt: string;
};

export type FlowDetail = { flow: { id: string; name: string }; generations: FlowGeneration[] };

export const flowsQueryKey = ["flows"] as const;
export const flowQueryKey = (id: string) => ["flows", id] as const;

function flowsQueryUrl(filters: FlowGalleryFilters): string {
  const params = new URLSearchParams();
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.favoritesOnly) params.set("favorite", "1");
  const qs = params.toString();
  return qs ? `/api/flows?${qs}` : "/api/flows";
}

export function useFlows(filters: FlowGalleryFilters = {}) {
  return useQuery({
    queryFn: () => apiFetch<{ flows: FlowSummary[] }>(flowsQueryUrl(filters)),
    // Filters are server-side, so each combination is its own cache entry —
    // switching a filter chip shows that filter's own loading state instead
    // of a stale list from a different one.
    queryKey: [...flowsQueryKey, filters.q?.trim() || null, filters.kind ?? null, !!filters.favoritesOnly] as const,
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
    mutationFn: ({ id, generationId }: { id: string; generationId: string }) =>
      apiFetch(`/api/flows/${id}`, { body: JSON.stringify({ coverGenerationId: generationId }), method: "PATCH" }),
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
  /** One fresh key per intended generation (crypto.randomUUID() at the call
   * site) — a retry of the exact same HTTP request lands on the same row
   * instead of billing twice. A deliberate new attempt (the user's own
   * "Retry") mints its own fresh key, since that really is a new charge. */
  idempotencyKey: string;
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

/** Favorite/Unfavorite and Rename Asset — one PATCH, since both are small
 * per-generation field updates with the same ownership check. */
export function useUpdateGeneration(flowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ genId, ...patch }: { genId: string; name?: string; favorite?: boolean }) =>
      apiFetch(`/api/flows/${flowId}/generations/${genId}`, { body: JSON.stringify(patch), method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flowQueryKey(flowId) });
      queryClient.invalidateQueries({ queryKey: flowsQueryKey });
    },
  });
}

export type ReportReason = "inaccurate" | "inappropriate" | "copyright" | "harmful" | "other";

export function useReportGeneration(flowId: string) {
  return useMutation({
    mutationFn: ({ genId, reason, details }: { genId: string; reason: ReportReason; details?: string }) =>
      apiFetch(`/api/flows/${flowId}/generations/${genId}/report`, {
        body: JSON.stringify({ reason, ...(details ? { details } : {}) }),
        method: "POST",
      }),
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
