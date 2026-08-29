"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const telegramLinkQueryKey = ["account-telegram-link"] as const;

export type TelegramLinkStatus = {
  linked: boolean;
  telegramUsername: string | null;
};

// The link completes on Telegram's side (the deep link or a manually typed
// pin, redeemed by the webhook) — nothing pushes that back to this tab, so
// while `poll` is on (the row's expanded, credential shown, not linked yet)
// this refetches every few seconds until `linked` flips true, then stops.
export function useTelegramLinkStatus(poll = false) {
  return useQuery({
    queryFn: () => apiFetch<TelegramLinkStatus>("/api/account/telegram-link"),
    queryKey: telegramLinkQueryKey,
    refetchInterval: (query) => (poll && !query.state.data?.linked ? 3000 : false),
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

// Sends a 6-digit code to the linked Telegram chat — required before
// useUnlinkTelegram will succeed.
export function useSendUnlinkCode() {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ sent: true }>("/api/account/telegram-link/unlink-code", { method: "POST" }),
  });
}

export function useUnlinkTelegram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<{ ok: true }>("/api/account/telegram-link", {
        body: JSON.stringify({ code }),
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: telegramLinkQueryKey }),
  });
}
