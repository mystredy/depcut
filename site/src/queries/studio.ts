"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export type StudioSummary = {
  id: string;
  name: string;
  username: string;
  spaceType: string;
  role: "owner" | "manager";
  avatarImageKey: string | null;
};

export type Studio = {
  id: string;
  name: string;
  username: string;
  bio: string | null;
  spaceType: string;
  role: "owner" | "manager" | null;
  avatarImageKey: string | null;
  backgroundImageKey: string | null;
  showFollowerCount: boolean;
  linkedAccounts: Record<string, string>;
};

export const studiosQueryKey = ["studios"] as const;
export const studioQueryKey = (idOrUsername: string) => ["studio", idOrUsername] as const;
export const studioMembersQueryKey = (id: string) => ["studio-members", id] as const;
export const studioInvitesQueryKey = (id: string) => ["studio-invites", id] as const;
export const studioActivityQueryKey = (id: string) => ["studio-activity", id] as const;
export const studioConnectionsQueryKey = (id: string) => ["studio-connections", id] as const;
export const studioDropsQueryKey = (id: string) => ["studio-drops", id] as const;

export function useStudios() {
  return useQuery({
    queryFn: () => apiFetch<{ spaces: StudioSummary[] }>("/api/studios"),
    queryKey: studiosQueryKey,
  });
}

export function useCreateStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; username: string; spaceType?: string }) =>
      apiFetch<{ studio: { id: string; username: string } }>("/api/studios", {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studiosQueryKey }),
  });
}

export function useStudioByUsername(username: string | null) {
  return useQuery({
    enabled: !!username,
    queryFn: () => apiFetch<{ studio: Studio }>(`/api/studios/by-username/${username}`),
    queryKey: studioQueryKey(username ?? ""),
  });
}

export function useUpdateStudio(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name?: string;
      username?: string;
      bio?: string | null;
      showFollowerCount?: boolean;
      spaceType?: string;
      linkedAccounts?: Record<string, string>;
    }) =>
      apiFetch<{ studio: Studio }>(`/api/studios/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studiosQueryKey });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
      // useStudioByUsername keys on the username, not id, so this can't use
      // studioQueryKey(id) — invalidate every ["studio", *] by prefix
      // instead. It's what feeds the Setup/Linked accounts forms' dirty
      // check, and without it Save never goes back to disabled after the
      // first successful save this session.
      queryClient.invalidateQueries({ queryKey: ["studio"] });
    },
  });
}

export function useDeleteStudio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/api/studios/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studiosQueryKey }),
  });
}

export type StudioMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: "owner" | "manager";
};

export function useStudioMembers(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ members: StudioMember[] }>(`/api/studios/${id}/members`),
    queryKey: studioMembersQueryKey(id),
  });
}

export function useRemoveStudioMember(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}/members/${memberId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioMembersQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}

export type StudioInvite = { id: string; email: string; role: string; createdAt: string };

export function useStudioInvites(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ invites: StudioInvite[] }>(`/api/studios/${id}/invites`),
    queryKey: studioInvitesQueryKey(id),
  });
}

// Step 1 of inviting someone: emails a one-time code to the requesting
// manager's own address. See useSendStudioInvite for step 2.
export function useRequestStudioInviteCode(id: string) {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<{ challenge: string; sentTo: string }>(`/api/studios/${id}/invites/request-code`, {
        body: JSON.stringify({ email }),
        method: "POST",
      }),
  });
}

// Step 2: requires the challenge + code from useRequestStudioInviteCode,
// proving the requesting manager approved this exact invite from their own
// inbox, before the invite email goes out to the invitee.
export function useSendStudioInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, challenge, code }: { email: string; challenge: string; code: string }) =>
      apiFetch<{ invite: StudioInvite }>(`/api/studios/${id}/invites`, {
        body: JSON.stringify({ challenge, code, email }),
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioInvitesQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}

export function useRevokeStudioInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studioInvitesQueryKey(id) }),
  });
}

export function useAcceptStudioInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch<{ studio: { id: string; name: string; username: string } }>(
        `/api/studio-invites/${token}/accept`,
        { method: "POST" },
      ),
  });
}

export type StudioActivityEntry = {
  id: string;
  action: string;
  detail: string | null;
  actorName: string;
  createdAt: string;
};

export function useStudioActivity(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ activity: StudioActivityEntry[] }>(`/api/studios/${id}/activity`),
    queryKey: studioActivityQueryKey(id),
  });
}

export type StudioConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  profileImage: string | null;
  status: "active" | "inactive";
  hasToken: boolean;
  tokenExpiresAt: string | null;
};

export function useStudioConnections(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ connections: StudioConnection[] }>(`/api/studios/${id}/connections`),
    queryKey: studioConnectionsQueryKey(id),
  });
}

export function useDisconnectStudioConnection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (connectionId: string) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}/connections/${connectionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioConnectionsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}

export type StudioDrop = {
  id: string;
  caption: string | null;
  createdAt: string;
  error: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: "pending" | "uploading" | "complete" | "error";
  thumbnailKey: string | null;
};

export function useStudioDrops(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ drops: StudioDrop[] }>(`/api/studios/${id}/drops`),
    queryKey: studioDropsQueryKey(id),
  });
}
