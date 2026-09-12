"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export const spaceUsageQueryKey = ["space-usage"] as const;

// Storage usage against the flat 10GB-per-account quota — summed across
// every studio the account drops to. A specific studio's own drops come
// from useStudioDrops instead; there's no flat cross-studio feed.
export function useSpaceUsage() {
  return useQuery({
    queryFn: () => apiFetch<{ limitBytes: number; usedBytes: number }>("/api/drops"),
    queryKey: spaceUsageQueryKey,
  });
}

export function useCreateDrop() {
  return useMutation({
    mutationFn: (input: { caption?: string; projectId?: string | null; studioId: string }) =>
      apiFetch<{ drop: { id: string } }>("/api/drops", {
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

// Plain async function, not a hook — the id isn't known until a draft drop
// is created moments before this runs, and hooks can't be called from
// inside an event handler with a value picked at call time. Callers that
// upload for a drop already known at render time can still wrap this in
// their own useMutation; DropDialog calls it directly.
export async function uploadDropVideo(
  dropId: string,
  file: File,
  onProgress?: (fraction: number) => void
): Promise<void> {
  const { url } = await apiFetch<{ key: string; url: string }>(
    `/api/drops/${dropId}/presign`,
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
    await apiFetch(`/api/drops/${dropId}/fail`, {
      body: JSON.stringify({
        error: error instanceof Error ? error.message : "Upload failed",
      }),
      method: "POST",
    }).catch(() => {});
    throw error;
  }

  await apiFetch<{ ok: boolean }>(`/api/drops/${dropId}/complete`, { method: "POST" });
}
