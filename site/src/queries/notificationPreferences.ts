"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const notificationPreferencesQueryKey = ["account-notification-preferences"] as const;

export type NotificationPreferences = {
  pushPayouts: boolean;
  telegramAlerts: boolean;
  emailDigest: boolean;
};

export function useNotificationPreferences() {
  return useQuery({
    queryFn: () => apiFetch<NotificationPreferences>("/api/account/notification-preferences"),
    queryKey: notificationPreferencesQueryKey,
  });
}

export function useSetNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: Partial<NotificationPreferences>) =>
      apiFetch<NotificationPreferences>("/api/account/notification-preferences", {
        body: JSON.stringify(update),
        method: "PATCH",
      }),
    onSuccess: (prefs) => {
      queryClient.setQueryData(notificationPreferencesQueryKey, prefs);
    },
  });
}
