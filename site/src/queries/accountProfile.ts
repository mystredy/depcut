"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const accountProfileQueryKey = ["account-profile"] as const;

export type AccountProfile = {
  // The name Google gave us at sign-in.
  name: string;
  // The name the user chose for the product, when they've set one.
  displayName: string | null;
  email: string;
  image: string | null;
  // The @handle a Space is identified by — independent of displayName, and
  // unique across accounts. Null until the user picks one.
  username: string | null;
  bio: string | null;
  backgroundImage: string | null;
  // Whether My Space shows a follower count publicly — the count itself is
  // always 0 today, there's no follower graph yet.
  showFollowerCount: boolean;
};

// What the product calls you: your chosen name when you have one, otherwise
// the Google name. Every surface that shows the user's name reads this.
export function visibleName(profile: AccountProfile | undefined, fallback: string) {
  return profile?.displayName || profile?.name || fallback;
}

// `enabled` is for the signed-out case: the sidebar mounts this hook above its
// own session check, and the route answers 401 without a session.
export function useAccountProfile(options?: { enabled?: boolean }) {
  return useQuery({
    enabled: options?.enabled ?? true,
    queryFn: () => apiFetch<AccountProfile>("/api/account/profile"),
    queryKey: accountProfileQueryKey,
  });
}

// The picture arrives already cropped and compressed by the editor dialog, so
// it uploads as raw bytes rather than a base64 payload.
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob) =>
      apiFetch<AccountProfile>("/api/account/avatar", {
        body: image,
        headers: { "Content-Type": image.type },
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AccountProfile>("/api/account/avatar", { method: "DELETE" }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

// Same shape as the avatar: raw bytes, straight PUT, no crop step.
export function useUpdateBackgroundImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob) =>
      apiFetch<AccountProfile>("/api/account/background-image", {
        body: image,
        headers: { "Content-Type": image.type },
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useRemoveBackgroundImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<AccountProfile>("/api/account/background-image", { method: "DELETE" }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useUpdateDisplayName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string | null) =>
      apiFetch<AccountProfile>("/api/account/profile", {
        body: JSON.stringify({ displayName }),
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useUpdateUsername() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (username: string | null) =>
      apiFetch<AccountProfile>("/api/account/profile", {
        body: JSON.stringify({ username }),
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useUpdateBio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bio: string | null) =>
      apiFetch<AccountProfile>("/api/account/profile", {
        body: JSON.stringify({ bio }),
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}

export function useUpdateShowFollowerCount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (showFollowerCount: boolean) =>
      apiFetch<AccountProfile>("/api/account/profile", {
        body: JSON.stringify({ showFollowerCount }),
        method: "PUT",
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(accountProfileQueryKey, profile);
    },
  });
}
