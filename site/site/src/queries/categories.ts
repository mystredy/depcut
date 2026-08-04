"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const categoriesQueryKey = ["categories"] as const;

export type Category = {
  id: string;
  name: string;
  emoji: string;
  // Comma-separated example niches under this category.
  niches: string;
};

// The shared marketplace category taxonomy — Submit Project's category
// picker and the Inspiration board both read from here instead of keeping
// their own hardcoded list. The route self-seeds the table on first read.
export function useCategories() {
  return useQuery({
    queryFn: () => apiFetch<{ categories: Category[] }>("/api/categories"),
    queryKey: categoriesQueryKey,
    staleTime: 5 * 60 * 1000,
  });
}
