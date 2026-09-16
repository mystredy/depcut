// Real Facebook Graph API video publish for a connected Page. Used by
// /api/admin/social-connections/[id]/publish.
export class FacebookApiError extends Error {}

export async function publishFacebookVideo(opts: {
  accessToken: string;
  pageId: string;
  videoUrl: string;
  description?: string;
}): Promise<{ id: string; url: string }> {
  const res = await fetch(`https://graph.facebook.com/v21.0/${opts.pageId}/videos`, {
    body: new URLSearchParams({
      access_token: opts.accessToken,
      description: opts.description ?? "",
      file_url: opts.videoUrl,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.id) {
    throw new FacebookApiError(`Facebook rejected the video: ${data?.error?.message ?? res.status}`);
  }
  return { id: data.id as string, url: `https://www.facebook.com/${opts.pageId}/videos/${data.id}` };
}

export type FacebookVideo = { id: string; source: string; description?: string; createdTime: string };

// The read side of an import workflow (see social-workflow-import.ts) — a
// Page's own videos, newest first. The `source` field (a direct URL to the
// raw file) requires Meta's App Review approval for the relevant
// permission; until that's approved for this app, Facebook returns this
// field omitted or the call fails outright, same as any other unapproved
// permission — see IMPORTABLE_PLATFORMS's doc comment in oauth-providers.ts.
export async function listFacebookVideos(pageId: string, accessToken: string): Promise<FacebookVideo[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/videos?fields=id,source,description,created_time&access_token=${encodeURIComponent(accessToken)}`,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new FacebookApiError(`Facebook rejected the video list: ${data?.error?.message ?? res.status}`);
  }
  const items = (data?.data ?? []) as Array<{
    id: string;
    source?: string;
    description?: string;
    created_time: string;
  }>;
  return items
    .filter((item) => item.source)
    .map((item) => ({ createdTime: item.created_time, description: item.description, id: item.id, source: item.source! }));
}
