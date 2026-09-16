"use client";

import { useMutation } from "@tanstack/react-query";

import { apiFetch } from "@/queries/apiClient";

export function useCreateDrop() {
  return useMutation({
    mutationFn: (input: {
      title?: string;
      caption?: string;
      hashtags?: string;
      projectId?: string | null;
      studioId: string;
    }) =>
      apiFetch<{ drop: { id: string } }>("/api/drops", {
        body: JSON.stringify(input),
        method: "POST",
      }),
  });
}

// Real object storage: presign a PUT straight to R2, upload there directly
// (never through our server), then tell us to verify + record it — the same
// three-step shape as useUploadSubmissionAsset.
function uploadWithProgress(url: string, file: File, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // R2 answers a rejected PUT with an XML body naming the real reason
      // (AccessDenied, SignatureDoesNotMatch, ...) — surface it instead of a
      // bare "Upload failed" so the next failure is actually diagnosable.
      const code = /<Code>([^<]+)<\/Code>/.exec(xhr.responseText)?.[1];
      reject(new Error(`Upload failed (${xhr.status}${code ? ` ${code}` : ""})`));
    };
    // onerror fires with no status at all — a request that never got a response
    // (network drop, or the browser blocking it before it completed, e.g. CORS).
    xhr.onerror = () => reject(new Error("Upload failed (network error — check CORS if this repeats)"));
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

// Turns an uploaded draft into a real post — see /api/drops/[id]/publish.
export function publishDrop(
  dropId: string,
  input: { title?: string; caption?: string; hashtags?: string }
): Promise<void> {
  return apiFetch<{ ok: boolean }>(`/api/drops/${dropId}/publish`, {
    body: JSON.stringify(input),
    method: "POST",
  }).then(() => undefined);
}
