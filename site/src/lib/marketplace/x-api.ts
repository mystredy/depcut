// Real X (Twitter) API calls for a connected SocialConnection — chunked
// media upload (v1.1, still the only path for attaching video to a post)
// plus post creation (v2). Used by
// /api/admin/social-connections/[id]/publish.
//
// X gates meaningful write access (tweet.write + media upload at usable
// rate limits) behind a paid API tier. A connection on the free tier will
// get rejected by X itself here (403 / rate-limit style error), not by a
// bug in this code.
export class XApiError extends Error {}

async function uploadXMedia(accessToken: string, videoUrl: string): Promise<string> {
  const sourceRes = await fetch(videoUrl);
  if (!sourceRes.ok || !sourceRes.body) {
    throw new XApiError(`Couldn't fetch the video from that URL (${sourceRes.status}).`);
  }
  const mimeType = sourceRes.headers.get("content-type") ?? "video/mp4";
  const video = Buffer.from(await sourceRes.arrayBuffer());
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  const initRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    body: new URLSearchParams({
      command: "INIT",
      media_category: "tweet_video",
      media_type: mimeType,
      total_bytes: String(video.byteLength),
    }),
    headers: { ...authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const initData = await initRes.json().catch(() => null);
  const mediaId = initData?.media_id_string;
  if (!initRes.ok || !mediaId) {
    throw new XApiError(`X rejected the media upload: ${initData?.errors?.[0]?.message ?? initRes.status}`);
  }

  const appendForm = new FormData();
  appendForm.set("command", "APPEND");
  appendForm.set("media_id", mediaId);
  appendForm.set("segment_index", "0");
  appendForm.set("media", new Blob([video], { type: mimeType }));
  const appendRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    body: appendForm,
    headers: authHeader,
    method: "POST",
  });
  if (!appendRes.ok) {
    throw new XApiError(`X rejected the media chunk (${appendRes.status}).`);
  }

  const finalizeRes = await fetch("https://upload.twitter.com/1.1/media/upload.json", {
    body: new URLSearchParams({ command: "FINALIZE", media_id: mediaId }),
    headers: { ...authHeader, "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const finalizeData = await finalizeRes.json().catch(() => null);
  if (!finalizeRes.ok) {
    throw new XApiError(
      `X rejected the media finalize: ${finalizeData?.errors?.[0]?.message ?? finalizeRes.status}`,
    );
  }

  let processingState: string | undefined = finalizeData?.processing_info?.state;
  let attempts = 0;
  while (processingState && processingState !== "succeeded" && attempts < 10) {
    const checkAfterSecs = finalizeData?.processing_info?.check_after_secs ?? 2;
    await new Promise((resolve) => setTimeout(resolve, Math.min(checkAfterSecs, 10) * 1000));
    const statusRes = await fetch(
      `https://upload.twitter.com/1.1/media/upload.json?command=STATUS&media_id=${mediaId}`,
      { headers: authHeader },
    );
    const statusData = await statusRes.json().catch(() => null);
    processingState = statusData?.processing_info?.state;
    if (processingState === "failed") {
      throw new XApiError(
        `X failed to process the video: ${statusData?.processing_info?.error?.message ?? "unknown error"}`,
      );
    }
    attempts += 1;
  }

  return mediaId as string;
}

export async function publishXPost(opts: {
  accessToken: string;
  text: string;
  videoUrl?: string;
}): Promise<{ id: string; url: string }> {
  const mediaId = opts.videoUrl ? await uploadXMedia(opts.accessToken, opts.videoUrl) : null;

  const res = await fetch("https://api.twitter.com/2/tweets", {
    body: JSON.stringify({
      text: opts.text,
      ...(mediaId ? { media: { media_ids: [mediaId] } } : {}),
    }),
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.data?.id) {
    throw new XApiError(`X rejected the post: ${data?.detail ?? data?.errors?.[0]?.message ?? res.status}`);
  }

  return { id: data.data.id, url: `https://x.com/i/status/${data.data.id}` };
}
