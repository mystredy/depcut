"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const telegramLinkQueryKey = ["account-telegram-link"] as const;

export type TelegramLinkStatus = {
  linked: boolean;
  telegramUsername: string | null;
};

export function useTelegramLinkStatus() {
  return useQuery({
    queryFn: () => apiFetch<TelegramLinkStatus>("/api/account/telegram-link"),
    queryKey: telegramLinkQueryKey,
  });
}

export type TelegramLinkCredential = {
  deepLink: string;
  pin: string;
  botUsername: string;
  expiresInSeconds: number;
};

// Issues a fresh deep link + pin pair. The caller opens the deep link (a new
// tab, so the Depcut tab with Preferences open survives to show the linked
// state once the user comes back and this query refetches) and shows the pin
// as the fallback for whoever that link doesn't cleanly open Telegram for.
export function useCreateTelegramLink() {
  return useMutation({
    mutationFn: () =>
      apiFetch<TelegramLinkCredential>("/api/account/telegram-link", { method: "POST" }),
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ ok: true }>("/api/account/telegram-link", { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: telegramLinkQueryKey }),
  });
}
