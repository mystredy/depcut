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
