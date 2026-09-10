"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type BrandSpaceSummary = {
  id: string;
  name: string;
  username: string;
  spaceType: string;
  role: "owner" | "manager";
  avatarImageKey: string | null;
};

export type BrandSpace = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  spaceType: string;
  role: "owner" | "manager" | null;
  avatarImageKey: string | null;
  backgroundImageKey: string | null;
  linkedAccounts: Record<string, string>;
};

export const brandSpacesQueryKey = ["brand-spaces"] as const;
export const brandSpaceQueryKey = (idOrUsername: string) => ["brand-space", idOrUsername] as const;
export const brandSpaceMembersQueryKey = (id: string) => ["brand-space-members", id] as const;
export const brandSpaceInvitesQueryKey = (id: string) => ["brand-space-invites", id] as const;
export const brandSpaceActivityQueryKey = (id: string) => ["brand-space-activity", id] as const;
export const brandSpaceConnectionsQueryKey = (id: string) => ["brand-space-connections", id] as const;
export const brandSpacePostsQueryKey = (id: string) => ["brand-space-posts", id] as const;

export function useBrandSpaces() {
  return useQuery({
    queryFn: () => apiFetch<{ spaces: BrandSpaceSummary[] }>("/api/space/brand-spaces"),
    queryKey: brandSpacesQueryKey,
  });
}

export function useCreateBrandSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; username: string; spaceType?: string }) =>
      apiFetch<{ space: { id: string; username: string } }>("/api/space/brand-spaces", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: brandSpacesQueryKey }),
  });
}

export function useBrandSpaceByUsername(username: string | null) {
  return useQuery({
    enabled: !!username,
    queryFn: () => apiFetch<{ space: BrandSpace }>(`/api/space/brand-spaces/by-username/${username}`),
    queryKey: brandSpaceQueryKey(username ?? ""),
  });
}

export function useUpdateBrandSpace(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      username?: string;
      bio?: string | null;
      spaceType?: string;
      linkedAccounts?: Record<string, string>;
    }) =>
      apiFetch<{ space: BrandSpace }>(`/api/space/brand-spaces/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandSpacesQueryKey });
      queryClient.invalidateQueries({ queryKey: brandSpaceActivityQueryKey(id) });
    },
  });
}

export function useDeleteBrandSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/api/space/brand-spaces/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: brandSpacesQueryKey }),
  });
}

export type BrandSpaceMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: "owner" | "manager";
};

export function useBrandSpaceMembers(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ members: BrandSpaceMember[] }>(`/api/space/brand-spaces/${id}/members`),
    queryKey: brandSpaceMembersQueryKey(id),
  });
}

export function useRemoveBrandSpaceMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{ ok: boolean }>(`/api/space/brand-spaces/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandSpaceMembersQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: brandSpaceActivityQueryKey(id) });
    },
  });
}

export type BrandSpaceInvite = { id: string; email: string; role: string; createdAt: string };

export function useBrandSpaceInvites(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ invites: BrandSpaceInvite[] }>(`/api/space/brand-spaces/${id}/invites`),
    queryKey: brandSpaceInvitesQueryKey(id),
  });
}

export function useSendBrandSpaceInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ invite: BrandSpaceInvite }>(`/api/space/brand-spaces/${id}/invites`, {
        body: JSON.stringify({ email }),
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandSpaceInvitesQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: brandSpaceActivityQueryKey(id) });
    },
  });
}

export function useRevokeBrandSpaceInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ ok: boolean }>(`/api/space/brand-spaces/${id}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: brandSpaceInvitesQueryKey(id) }),
  });
}

export function useAcceptBrandSpaceInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ space: { id: string; name: string; username: string } }>(
        `/api/space/brand-space-invites/${token}/accept`,
        { method: "POST" },
      ),
  });
}

export type BrandSpaceActivityEntry = {
  id: string;
  action: string;
  detail: string | null;
  actorName: string;
  createdAt: string;
};

export function useBrandSpaceActivity(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ activity: BrandSpaceActivityEntry[] }>(`/api/space/brand-spaces/${id}/activity`),
    queryKey: brandSpaceActivityQueryKey(id),
  });
}

export type BrandSpaceConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  profileImage: string | null;
  status: "active" | "inactive";
  hasToken: boolean;
  tokenExpiresAt: string | null;
};

export function useBrandSpaceConnections(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ connections: BrandSpaceConnection[] }>(`/api/space/brand-spaces/${id}/connections`),
    queryKey: brandSpaceConnectionsQueryKey(id),
  });
}

export function useDisconnectBrandSpaceConnection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<{ ok: boolean }>(`/api/space/brand-spaces/${id}/connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandSpaceConnectionsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: brandSpaceActivityQueryKey(id) });
    },
  });
}

export type BrandSpacePost = {
  id: string;
  caption: string | null;
  createdAt: string;
  error: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: "pending" | "uploading" | "complete" | "error";
  thumbnailKey: string | null;
};

export function useBrandSpacePosts(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ posts: BrandSpacePost[] }>(`/api/space/brand-spaces/${id}/posts`),
    queryKey: brandSpacePostsQueryKey(id),
  });
}
