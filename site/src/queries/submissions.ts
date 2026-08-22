"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const submissionsQueryKey = ["submissions"] as const;
export const submissionQueryKey = (id: string) => ["submissions", id] as const;

export type AssetType = "video" | "thumbnail" | "verification";

export type SubmissionAsset = {
  id: string;
  submissionId: string;
  type: AssetType;
  fileName: string | null;
  storageKey: string | null;
  status: "pending" | "uploading" | "complete" | "failed";
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

// status: "draft" (freely editable) | "submitting" (Submit clicked, at
// least one required asset still isn't "complete") | "submitted" (every
// required asset landed) | "failed" (one didn't — retry re-uploads just
// that asset, no new submission). Once review picks it up, the existing
// admin flow can further advance status to "Approved" | "Rejected".
export type Submission = {
  id: string;
  userId: string;
  // Set when this draft came from the editor's Submit button — see
  // useCreateDraftSubmission. The submit-project page shows the linked
  // project's title instead of the video/thumbnail/verification drop-zones.
  projectId: string | null;
  project:
    | {
        name: string;
        // The linked project's preview state, same fields the Projects page
        // reads — present once the project lookup resolves (omitted, not
        // null, on the rare row where it doesn't).
        hasPreview?: boolean;
        previewFile?: string;
        previewIsImage?: boolean;
        previewStart?: number;
      }
    | null;
  subSource: string | null;
  subType: string;
  extension: string;
  title: string | null;
  categoryId: string | null;
  category: { name: string; emoji: string } | null;
  status: string | null;
  statusRemark: string | null;
  points: number | null;
  amount: number | null;
  reward: number | null;
  inspireUrl: string | null;
  taskId: string | null;
  spaceid: string | null;
  voiceScript: string | null;
  duration: number | null;
  publishingid: string | null;
  editCode: string | null;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  burnInCaptions: boolean;
  generatedMetadata: boolean;
  packageTitle: string | null;
  packageDescription: string | null;
  packageTags: string | null;
  maxRates: number | null;
  earnedRates: number | null;
  additionalReward: number | null;
  publisherWorkdone: number | null;
  creatorWorkdone: number | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewRemark: string | null;
  reviewStatus: string | null;
  reviewedByName: string | null;
  reviewStartedAt: string | null;
  reviewCompletedAt: string | null;
  createdAt: string;
  submitRequestedAt: string | null;
  submittedAt: string | null;
  updatedAt: string;
  assets: SubmissionAsset[];
};

// The signed-in user's own submissions, every status — feeds My Submissions'
// Draft/In Progress/Action Required/Submitted tabs.
export function useSubmissions() {
  return useQuery({
    queryFn: () => apiFetch<{ submissions: Submission[] }>("/api/submissions"),
    queryKey: submissionsQueryKey,
  });
}

// One submission, for the Submit Project editor. Polls while "submitting" so
// the page picks up promotion to "submitted" (or a drop to "failed") on its
// own, without the creator needing to do anything once they've hit Submit.
export function useSubmission(id: string | null) {
  return useQuery({
    enabled: Boolean(id),
    queryFn: () => apiFetch<{ submission: Submission }>(`/api/submissions/${id}`),
    queryKey: submissionQueryKey(id ?? ""),
    refetchInterval: (query) => (query.state.data?.submission.status === "submitting" ? 3000 : false),
  });
}

// "New Submit" calls this — no fields required, the row exists the instant
// this resolves and the page navigates to it. The editor's Submit button
// passes projectId to link the draft to that project instead.
export function useCreateDraftSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId?: string) =>
      apiFetch<{ submission: Submission }>("/api/submissions", {
        method: "POST",
        ...(projectId
          ? { body: JSON.stringify({ projectId }), headers: { "Content-Type": "application/json" } }
          : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });
}

export type AutosaveSubmissionInput = Partial<{
  title: string;
  categoryId: string;
  subSource: "InspiredExternal" | "TaskExternal";
  inspireUrl: string;
  voiceScript: string;
  spaceid: string;
  extension: "standard" | "pro";
  editCode: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  burnInCaptions: boolean;
  generatedMetadata: boolean;
  packageTitle: string;
  packageDescription: string;
  packageTags: string;
}>;

// Every Submit Project field edit lands here, debounced client-side. Only
// works while the draft is still "draft" — the server rejects it otherwise.
export function useAutosaveSubmission(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AutosaveSubmissionInput) =>
      apiFetch<{ submission: Submission }>(`/api/submissions/${id}`, {
        body: JSON.stringify(input),
        method: "PATCH",
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(submissionQueryKey(id), data);
    },
  });
}

// Doesn't wait on uploads — locks the row and moves it to "submitting" (or
// straight to "submitted" if every asset had already finished). The server
// validates required fields/assets are at least picked; see
// /api/submissions/[id]/submit for the exact list.
export function useSubmitSubmission(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ submission: Submission }>(`/api/submissions/${id}/submit`, { method: "POST" }),
    onSuccess: (data) => {
      queryClient.setQueryData(submissionQueryKey(id), data);
      void queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });
}

// Only a draft or failed submission can be deleted — see
// /api/submissions/[id] DELETE.
export function useDeleteSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/api/submissions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: submissionsQueryKey });
    },
  });
}

// Real object storage: presign a PUT straight to R2, upload there directly
// (never through our server), then tell us to verify + record it. Mirrors
// the Cut engine's own media upload flow (src/cut/server/cloud/media.ts).
function uploadWithProgress(url: string, blob: Blob, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", blob.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(blob);
  });
}

// One hook for all three asset types — the submission row already exists by
// the time this is ever called, so every upload is scoped to its real id
// from the start (no client-generated draft id). Uploads start the instant
// a file is picked; Submit doesn't wait for this to resolve. On failure,
// tells the server so a submission that already asked to submit gets
// flipped to "failed" rather than hanging.
export function useUploadSubmissionAsset(submissionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      type,
      file,
      onProgress,
    }: {
      type: AssetType;
      file: File | Blob;
      onProgress?: (fraction: number) => void;
    }) => {
      const fileName = file instanceof File ? file.name : undefined;
      const mime = file.type || "application/octet-stream";
      const { url } = await apiFetch<{ key: string; url: string }>(
        `/api/submissions/${submissionId}/assets/${type}/presign`,
        { body: JSON.stringify({ fileName, mime }), method: "POST" }
      );

      try {
        await uploadWithProgress(url, file, onProgress);
      } catch (error) {
        await apiFetch(`/api/submissions/${submissionId}/assets/${type}/fail`, {
          body: JSON.stringify({
            error: error instanceof Error ? error.message : "Upload failed",
          }),
          method: "POST",
        }).catch(() => {});
        throw error;
      }

      await apiFetch<{ ok: boolean }>(`/api/submissions/${submissionId}/assets/${type}/complete`, {
        method: "POST",
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: submissionQueryKey(submissionId) });
    },
  });
}
