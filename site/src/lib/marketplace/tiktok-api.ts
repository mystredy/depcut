// Real TikTok Content Posting API calls (Direct Post, FILE_UPLOAD source)
// for a connected SocialConnection. Used by
// /api/admin/social-connections/[id]/publish.
//
// TikTok forces privacy_level to SELF_ONLY for any app that hasn't passed
// their content-posting audit, regardless of what's requested — posts land
// as private drafts visible only to the connected account until TikTok
// approves the app for public posting. That's TikTok's own enforcement,
// not a limitation of this code.
export class TiktokApiError extends Error {}

// Single-chunk upload only (TikTok's per-chunk ceiling is 64MB) — fine for
// Shorts-length clips; a longer video needs real multi-chunk APPEND logic.
const MAX_SINGLE_CHUNK_BYTES = 64 * 1024 * 1024;

export async function publishTiktokVideo(opts: {
  accessToken: string;
  videoUrl: string;
  caption: string;
}): Promise<{ publishId: string }> {
  const sourceRes = await fetch(opts.videoUrl);
  if (!sourceRes.ok || !sourceRes.body) {
    throw new TiktokApiError(`Couldn't fetch the video from that URL (${sourceRes.status}).`);
  }
  const video = Buffer.from(await sourceRes.arrayBuffer());
  if (video.byteLength > MAX_SINGLE_CHUNK_BYTES) {
    throw new TiktokApiError("Video is over 64MB — this single-chunk uploader only supports clips up to that size.");
  }

  const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    body: JSON.stringify({
      post_info: {
        privacy_level: "SELF_ONLY",
        title: opts.caption,
      },
      source_info: {
        chunk_size: video.byteLength,
        source: "FILE_UPLOAD",
        total_chunk_count: 1,
        video_size: video.byteLength,
      },
    }),
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    method: "POST",
  });
  const initData = await initRes.json().catch(() => null);
  const uploadUrl = initData?.data?.upload_url;
  const publishId = initData?.data?.publish_id;
  if (!initRes.ok || !uploadUrl || !publishId) {
    throw new TiktokApiError(
      `TikTok rejected the upload session: ${initData?.error?.message ?? initRes.status}`,
    );
  }

  const uploadRes = await fetch(uploadUrl, {
    body: video,
    headers: {
      "Content-Range": `bytes 0-${video.byteLength - 1}/${video.byteLength}`,
      "Content-Type": "video/mp4",
    },
    method: "PUT",
  });
  if (!uploadRes.ok) {
    throw new TiktokApiError(`TikTok rejected the video bytes (${uploadRes.status}).`);
  }

  return { publishId: publishId as string };
}
