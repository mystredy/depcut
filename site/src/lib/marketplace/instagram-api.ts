// Real Instagram Graph API video (Reels) publish for a connected Business
// Account — a two-step container flow: create a media container, poll
// until it's finished processing, then publish it. Used by
// /api/admin/social-connections/[id]/publish.
export class InstagramApiError extends Error {}

export async function publishInstagramVideo(opts: {
  accessToken: string;
  igUserId: string;
  videoUrl: string;
  caption?: string;
}): Promise<{ id: string; url: string }> {
  const initRes = await fetch(`https://graph.facebook.com/v21.0/${opts.igUserId}/media`, {
    body: new URLSearchParams({
      access_token: opts.accessToken,
      caption: opts.caption ?? "",
      media_type: "REELS",
      video_url: opts.videoUrl,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const initData = await initRes.json().catch(() => null);
  const containerId = initData?.id;
  if (!initRes.ok || !containerId) {
    throw new InstagramApiError(`Instagram rejected the video: ${initData?.error?.message ?? initRes.status}`);
  }

  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusRes = await fetch(
      `https://graph.facebook.com/v21.0/${containerId}?fields=status_code&access_token=${encodeURIComponent(opts.accessToken)}`,
    );
    const statusData = await statusRes.json().catch(() => null);
    status = statusData?.status_code ?? "ERROR";
    attempts += 1;
  }
  if (status !== "FINISHED") {
    throw new InstagramApiError(`Instagram couldn't process the video (status: ${status}).`);
  }

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${opts.igUserId}/media_publish`, {
    body: new URLSearchParams({ access_token: opts.accessToken, creation_id: containerId }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const publishData = await publishRes.json().catch(() => null);
  const mediaId = publishData?.id;
  if (!publishRes.ok || !mediaId) {
    throw new InstagramApiError(`Instagram rejected the publish: ${publishData?.error?.message ?? publishRes.status}`);
  }

  const permalinkRes = await fetch(
    `https://graph.facebook.com/v21.0/${mediaId}?fields=permalink&access_token=${encodeURIComponent(opts.accessToken)}`,
  );
  const permalinkData = await permalinkRes.json().catch(() => null);

  return {
    id: mediaId as string,
    url: (permalinkData?.permalink as string | undefined) ?? `https://www.instagram.com/reel/${mediaId}/`,
  };
}
