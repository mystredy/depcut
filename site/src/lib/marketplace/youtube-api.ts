// Real YouTube Data/Analytics API calls for a connected SocialConnection
// (youtube or youtube_shorts platform) — video publish and channel
// analytics. Used by /api/admin/social-connections/[id]/publish and
// .../analytics, triggered manually from /admin/social/connections. Token
// refresh is shared with every other standard-OAuth2 platform — see
// oauth-token-refresh.ts.
export class YoutubeApiError extends Error {}

// Fetches the video from videoUrl and re-uploads it to YouTube via the
// resumable upload protocol. Buffers the whole video in memory — fine for
// Shorts-length clips (well under Vercel's function memory ceiling); a
// long-form multi-GB video would need a streaming rewrite instead.
export async function publishYoutubeVideo(opts: {
  accessToken: string;
  videoUrl: string;
  title: string;
  description?: string;
  privacyStatus: "public" | "unlisted" | "private";
}): Promise<{ videoId: string; url: string }> {
  const sourceRes = await fetch(opts.videoUrl);
  if (!sourceRes.ok || !sourceRes.body) {
    throw new YoutubeApiError(`Couldn't fetch the video from that URL (${sourceRes.status}).`);
  }
  const mimeType = sourceRes.headers.get("content-type") ?? "video/mp4";
  const video = Buffer.from(await sourceRes.arrayBuffer());

  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      body: JSON.stringify({
        snippet: { description: opts.description ?? "", title: opts.title },
        status: { privacyStatus: opts.privacyStatus },
      }),
      headers: {
        Authorization: `Bearer ${opts.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(video.byteLength),
        "X-Upload-Content-Type": mimeType,
      },
      method: "POST",
    },
  );
  const uploadUrl = initRes.headers.get("location");
  if (!initRes.ok || !uploadUrl) {
    const detail = await initRes.text().catch(() => "");
    throw new YoutubeApiError(`YouTube rejected the upload session: ${detail || initRes.status}`);
  }

  const uploadRes = await fetch(uploadUrl, {
    body: video,
    headers: { "Content-Length": String(video.byteLength), "Content-Type": mimeType },
    method: "PUT",
  });
  const data = await uploadRes.json().catch(() => null);
  if (!uploadRes.ok || !data?.id) {
    throw new YoutubeApiError(`YouTube rejected the video: ${data?.error?.message ?? uploadRes.status}`);
  }

  return { url: `https://youtube.com/watch?v=${data.id}`, videoId: data.id as string };
}

export type YoutubeAnalyticsRow = {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  likes: number;
  subscribersGained: number;
};

// Channel-level daily stats for the connected account (yt-analytics.readonly)
// — not per-video, since a connection isn't tied to a specific upload.
export async function getYoutubeChannelAnalytics(opts: {
  accessToken: string;
  days?: number;
}): Promise<YoutubeAnalyticsRow[]> {
  const days = opts.days ?? 28;
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    dimensions: "day",
    endDate: isoDate(end),
    ids: "channel==MINE",
    metrics: "views,estimatedMinutesWatched,likes,subscribersGained",
    sort: "day",
    startDate: isoDate(start),
  });

  const res = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, {
    headers: { Authorization: `Bearer ${opts.accessToken}` },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !Array.isArray(data?.rows)) {
    throw new YoutubeApiError(`YouTube Analytics rejected the request: ${data?.error?.message ?? res.status}`);
  }

  return (data.rows as [string, number, number, number, number][]).map(
    ([day, views, estimatedMinutesWatched, likes, subscribersGained]) => ({
      day,
      estimatedMinutesWatched,
      likes,
      subscribersGained,
      views,
    }),
  );
}
