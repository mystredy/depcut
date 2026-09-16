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
  updatedAt: string;
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
  updatedAt: string;
};

// Fixed-key R2 objects (see studioAvatarKey/studioBackgroundKey in r2.ts) —
// the ?v= cache-busts the browser once a new image replaces the old one at
// the same key.
export function studioAvatarUrl(studio: { id: string; avatarImageKey: string | null; updatedAt: string }) {
  return studio.avatarImageKey ? `/api/studios/${studio.id}/avatar?v=${Date.parse(studio.updatedAt)}` : null;
}

export function studioBackgroundUrl(studio: {
  id: string;
  backgroundImageKey: string | null;
  updatedAt: string;
}) {
  return studio.backgroundImageKey
    ? `/api/studios/${studio.id}/background?v=${Date.parse(studio.updatedAt)}`
    : null;
}

export const studiosQueryKey = ["studios"] as const;
export const studioQueryKey = (idOrUsername: string) => ["studio", idOrUsername] as const;
export const studioMembersQueryKey = (id: string) => ["studio-members", id] as const;
export const studioInvitesQueryKey = (id: string) => ["studio-invites", id] as const;
export const studioActivityQueryKey = (id: string) => ["studio-activity", id] as const;
export const studioConnectionsQueryKey = (id: string) => ["studio-connections", id] as const;
export const studioDropsQueryKey = (id: string) => ["studio-drops", id] as const;
export const studioWorkflowsQueryKey = (id: string) => ["studio-workflows", id] as const;

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

function invalidateStudio(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  queryClient.invalidateQueries({ queryKey: studiosQueryKey });
  queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
  // Keyed by username, not id — see useUpdateStudio's own comment on why
  // this invalidates every ["studio", *] by prefix instead.
  queryClient.invalidateQueries({ queryKey: ["studio"] });
}

export function useUpdateStudioAvatar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob) =>
      apiFetch<{ studio: Studio }>(`/api/studios/${id}/avatar`, {
        body: image,
        headers: { "Content-Type": image.type },
        method: "PUT",
      }),
    onSuccess: () => invalidateStudio(queryClient, id),
  });
}

export function useRemoveStudioAvatar(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ studio: Studio }>(`/api/studios/${id}/avatar`, { method: "DELETE" }),
    onSuccess: () => invalidateStudio(queryClient, id),
  });
}

export function useUpdateStudioBackground(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (image: Blob) =>
      apiFetch<{ studio: Studio }>(`/api/studios/${id}/background`, {
        body: image,
        headers: { "Content-Type": image.type },
        method: "PUT",
      }),
    onSuccess: () => invalidateStudio(queryClient, id),
  });
}

export function useRemoveStudioBackground(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ studio: Studio }>(`/api/studios/${id}/background`, { method: "DELETE" }),
    onSuccess: () => invalidateStudio(queryClient, id),
  });
}

export function useRequestStudioDeleteCode(id: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ challenge: string; sentTo: string; telegramRequired: boolean }>(
        `/api/studios/${id}/request-delete-code`,
        { method: "POST" },
      ),
  });
}

// Requires the challenge + code from useRequestStudioDeleteCode, proving the
// owner approved this exact deletion from their own inbox — and, when
// telegramRequired came back true, the second code Telegram also got.
export function useDeleteStudio(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challenge, code, telegramCode }: { challenge: string; code: string; telegramCode?: string }) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}`, {
        body: JSON.stringify({ challenge, code, telegramCode }),
        method: "DELETE",
      }),
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
      apiFetch<{ challenge: string; sentTo: string; telegramRequired: boolean }>(
        `/api/studios/${id}/invites/request-code`,
        { body: JSON.stringify({ email }), method: "POST" },
      ),
  });
}

// Step 2: requires the challenge + code from useRequestStudioInviteCode,
// proving the requesting manager approved this exact invite from their own
// inbox — and, when telegramRequired came back true, the second code
// Telegram also got — before the invite email goes out to the invitee.
export function useSendStudioInvite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      email,
      challenge,
      code,
      telegramCode,
    }: {
      email: string;
      challenge: string;
      code: string;
      telegramCode?: string;
    }) =>
      apiFetch<{ invite: StudioInvite }>(`/api/studios/${id}/invites`, {
        body: JSON.stringify({ challenge, code, email, telegramCode }),
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
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
};

export function useStudioConnections(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ connections: StudioConnection[] }>(`/api/studios/${id}/connections`),
    queryKey: studioConnectionsQueryKey(id),
  });
}

export function useRenameStudioConnection(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, accountName }: { connectionId: string; accountName: string }) =>
      apiFetch<{ connection: StudioConnection }>(`/api/studios/${id}/connections/${connectionId}`, {
        body: JSON.stringify({ accountName }),
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioConnectionsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
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

export type StudioConnectionAnalyticsRow = {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  subscribersGained: number;
};

// Fetched on demand (not a background query) since it calls YouTube live —
// see /api/studios/[id]/connections/[connectionId]/analytics.
export function useStudioConnectionAnalytics(id: string) {
  return useMutation({
    mutationFn: ({ connectionId, days }: { connectionId: string; days?: number }) =>
      apiFetch<{ rows: StudioConnectionAnalyticsRow[] }>(
        `/api/studios/${id}/connections/${connectionId}/analytics${days ? `?days=${days}` : ""}`,
      ),
  });
}

export type StudioWorkflowConnection = {
  id: string;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  profileImage: string | null;
};

export type StudioWorkflow = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  autoPublish: boolean;
  postsPerDay: number | null;
  sourceConnection: StudioWorkflowConnection;
  destinationConnection: StudioWorkflowConnection;
  createdAt: string;
  updatedAt: string;
};

export function useStudioWorkflows(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ workflows: StudioWorkflow[] }>(`/api/studios/${id}/workflows`),
    queryKey: studioWorkflowsQueryKey(id),
  });
}

export function useCreateStudioWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      sourceConnectionId: string;
      destinationConnectionId: string;
      autoPublish?: boolean;
      postsPerDay?: number | null;
    }) =>
      apiFetch<{ workflow: StudioWorkflow }>(`/api/studios/${id}/workflows`, {
        body: JSON.stringify(input),
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioWorkflowsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}

export function useUpdateStudioWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workflowId,
      ...input
    }: {
      workflowId: string;
      name?: string;
      status?: "Active" | "Inactive";
      autoPublish?: boolean;
      sourceConnectionId?: string;
      destinationConnectionId?: string;
      postsPerDay?: number | null;
    }) =>
      apiFetch<{ workflow: StudioWorkflow }>(`/api/studios/${id}/workflows/${workflowId}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studioWorkflowsQueryKey(id) }),
  });
}

export function useDeleteStudioWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}/workflows/${workflowId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioWorkflowsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}

export type StudioDropPublication = {
  platform: string;
  destinationAccountName: string;
  externalPostId: string | null;
  externalUrl: string | null;
};

export type StudioDrop = {
  id: string;
  title: string | null;
  caption: string | null;
  hashtags: string[];
  createdAt: string;
  error: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: "pending" | "uploading" | "draft" | "complete" | "error";
  thumbnailKey: string | null;
  publications: StudioDropPublication[];
};

export function useStudioDrops(id: string) {
  return useQuery({
    queryFn: () => apiFetch<{ drops: StudioDrop[] }>(`/api/studios/${id}/drops`),
    queryKey: studioDropsQueryKey(id),
  });
}

export type DropAnalytics = { accountName: string; views: number; likes: number; comments: number };

// Fetched on demand, not a background query — it calls YouTube live.
export function useDropAnalytics(studioId: string) {
  return useMutation({
    mutationFn: (dropId: string) =>
      apiFetch<DropAnalytics>(`/api/studios/${studioId}/drops/${dropId}/analytics`),
  });
}

// A manual, one-off publish of an already-posted drop to a connected
// platform right now — see /api/studios/[id]/drops/[dropId]/repurpose.
export function useRepurposeDrop(studioId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dropId, destinationConnectionId }: { dropId: string; destinationConnectionId: string }) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${studioId}/drops/${dropId}/repurpose`, {
        body: JSON.stringify({ destinationConnectionId }),
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studioDropsQueryKey(studioId) }),
  });
}

export function useRemoveStudioDrop(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dropId: string) =>
      apiFetch<{ ok: boolean }>(`/api/studios/${id}/drops/${dropId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studioDropsQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: studioActivityQueryKey(id) });
    },
  });
}
