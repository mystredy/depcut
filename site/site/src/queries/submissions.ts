"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const submissionsQueryKey = ["submissions"] as const;

export type Submission = {
  id: string;
  userId: string;
  subSource: string | null;
  subType: string;
  extension: string;
  title: string;
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
  videofile: string | null;
  thumbnailFile: string | null;
  hasThumbnail: boolean;
  hasVideo: boolean;
  duration: number | null;
  publishingid: string | null;
  editCode: string | null;
  watermarkEnabled: boolean;
  watermarkText: string | null;
  burnInCaptions: boolean;
  generatedMetadata: boolean;
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
  submittedAt: string;
  updatedAt: string;
};

export type CreateSubmissionInput = {
  title: string;
  categoryId: string;
  subSource: "InspiredExternal" | "TaskExternal";
  inspireUrl?: string;
  voiceScript: string;
  spaceid: string;
  videofile?: string;
  thumbnailFile?: string;
  // R2 keys, already uploaded — see the draft upload hooks below. Uploads
  // start the instant a file is picked, well before this call fires.
  thumbnailKey?: string;
  videoKey?: string;
  extension: "standard" | "pro";
  editCode?: string;
  watermarkEnabled: boolean;
  watermarkText?: string;
  burnInCaptions: boolean;
  generatedMetadata: boolean;
  // Pro Verification Suite only — becomes the linked Upload's publishing package.
  packageTitle?: string;
  description?: string;
  tags?: string;
  mediaFile?: string;
  verificationKey?: string;
};

// The signed-in user's own submissions — feeds My Submissions.
export function useSubmissions() {
  return useQuery({
    queryFn: () => apiFetch<{ submissions: Submission[] }>("/api/submissions"),
    queryKey: submissionsQueryKey,
  });
}

export function useCreateSubmission() {
  return useMutation({
    mutationFn: (input: CreateSubmissionInput) =>
      apiFetch<{ submission: Submission }>("/api/submissions", {
        body: JSON.stringify(input),
        method: "POST",
      }),
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

// Uploads start the moment a file is picked, before any Submission row
// exists — so these are keyed by a client-generated draftId (crypto.randomUUID())
// rather than a submission id. Each hook resolves to the R2 key once the
// bytes land; that key rides along in the final createSubmission call
// instead of a separate "complete" round-trip. A draft that's never
// submitted is swept later (see /api/admin/marketplace/sweep-drafts).
export function useUploadSubmissionThumbnail() {
  return useMutation({
    mutationFn: async ({
      draftId,
      blob,
      onProgress,
    }: {
      draftId: string;
      blob: Blob;
      onProgress?: (fraction: number) => void;
    }) => {
      const { key, url } = await apiFetch<{ key: string; url: string }>(
        `/api/submissions/drafts/${draftId}/thumbnail/presign`,
        { body: JSON.stringify({ mime: blob.type }), method: "POST" }
      );
      await uploadWithProgress(url, blob, onProgress);
      return { key };
    },
  });
}

export function useUploadSubmissionVideo() {
  return useMutation({
    mutationFn: async ({
      draftId,
      file,
      onProgress,
    }: {
      draftId: string;
      file: File;
      onProgress?: (fraction: number) => void;
    }) => {
      const { key, url } = await apiFetch<{ key: string; url: string }>(
        `/api/submissions/drafts/${draftId}/video/presign`,
        { body: JSON.stringify({ fileName: file.name, mime: file.type }), method: "POST" }
      );
      await uploadWithProgress(url, file, onProgress);
      return { key };
    },
  });
}

// Pro submissions only — the verification export attaches to the linked
// Upload row once the submission is created, not before.
export function useUploadSubmissionVerification() {
  return useMutation({
    mutationFn: async ({
      draftId,
      file,
      onProgress,
    }: {
      draftId: string;
      file: File;
      onProgress?: (fraction: number) => void;
    }) => {
      const { key, url } = await apiFetch<{ key: string; url: string }>(
        `/api/submissions/drafts/${draftId}/verification/presign`,
        { body: JSON.stringify({ fileName: file.name, mime: file.type }), method: "POST" }
      );
      await uploadWithProgress(url, file, onProgress);
      return { key };
    },
  });
}
