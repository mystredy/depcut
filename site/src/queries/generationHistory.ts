"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

// One shared shape for every AI Suite tool's durable, server-saved history —
// GET /api/<basePath> returning { [listKey]: T[] } and DELETE
// /api/<basePath>/<id>. Each tool's list route and row shape differ, so this
// stays a thin factory rather than one shared component; see
// TranscriptionAccountHistory.tsx for why the text-preview UI itself isn't
// genericized the same way.
export function useGenerationHistory<T>(basePath: string, listKey: string) {
  return useQuery({
    queryFn: () => apiFetch<Record<string, T[]>>(`/api/${basePath}`).then((r) => r[listKey]),
    queryKey: [basePath],
  });
}

export function useDeleteGeneration(basePath: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: true }>(`/api/${basePath}/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [basePath] }),
  });
}
