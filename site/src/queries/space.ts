"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const spacePostsQueryKey = ["space-posts"] as const;

export type SpacePost = {
  id: string;
  caption: string | null;
  createdAt: string;
  error: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  status: "pending" | "uploading" | "complete" | "error";
  thumbnailKey: string | null;
};

export function useSpacePosts() {
  return useQuery({
    queryFn: () =>
      apiFetch<{ limitBytes: number; posts: SpacePost[]; usedBytes: number }>(
        "/api/space/posts"
      ),
    queryKey: spacePostsQueryKey,
  });
}

export function useCreateSpacePost() {
  return useMutation({
    mutationFn: (input: { caption?: string; projectId?: string | null }) =>
      apiFetch<{ post: { id: string } }>("/api/space/posts", {
        body: JSON.stringify(input),
        method: "POST",
      }),
  });
}

// Real object storage: presign a PUT straight to R2, upload there directly
// (never through our server), then tell us to verify + record it — the same
// three-step shape as useUploadSubmissionAsset, plus a size on the presign
// call so the 10GB quota can be checked before any bytes move.
function uploadWithProgress(url: string, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed"));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

// Plain async function, not a hook — the id isn't known until a draft post
// is created moments before this runs, and hooks can't be called from
// inside an event handler with a value picked at call time. Callers that
// upload for a post already known at render time can still wrap this in
// their own useMutation; PostToSpaceDialog calls it directly.
export async function postSpaceVideo(
  postId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const { url } = await apiFetch<{ key: string; url: string }>(
    `/api/space/posts/${postId}/presign`,
    {
      body: JSON.stringify({
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size,
      }),
      method: "POST",
    }
  );

  try {
    await uploadWithProgress(url, file, onProgress);
  } catch (error) {
    await apiFetch(`/api/space/posts/${postId}/fail`, {
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Upload failed",
      }),
      method: "POST",
    }).catch(() => {});
    throw error;
  }

  await apiFetch<{ ok: boolean }>(`/api/space/posts/${postId}/complete`, { method: "POST" });
}
