// Real Threads API calls for a connected SocialConnection — long-lived
// token exchange/refresh (Meta's th_exchange_token / th_refresh_token
// grants, distinct from both the standard OAuth2 refresh_token grant used
// by youtube/tiktok/x, and from Facebook/Instagram's no-refresh Page
// tokens) and container-based video publish. Used by the OAuth callback
// route and /api/admin/social-connections/[id]/publish.
import { prisma } from "@/lib/prisma";

export class ThreadsApiError extends Error {}

// The short-lived token from the initial code exchange (~1 hour) is
// upgraded to a long-lived one (~60 days) right after connecting, so the
// stored token doesn't go stale almost immediately.
export async function exchangeForLongLivedThreadsToken(opts: {
  shortLivedToken: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const params = new URLSearchParams({
    access_token: opts.shortLivedToken,
    client_secret: opts.clientSecret,
    grant_type: "th_exchange_token",
  });
  const res = await fetch(`https://graph.threads.net/access_token?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new ThreadsApiError(
      `Threads rejected the long-lived token exchange: ${data?.error?.message ?? res.status}`,
    );
  }
  return { accessToken: data.access_token as string, expiresIn: data.expires_in ?? null };
}

// Refreshes a long-lived token when it's getting close to expiry — only
// works on a token that's already at least 24h old, per Threads' own
// rules, which is why this checks against a multi-day window rather than
// refreshing right up to the deadline.
export async function getValidThreadsAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.accessToken) {
    throw new ThreadsApiError("This connection has no stored access token — reconnect it.");
  }

  const expiresSoon =
    !connection.tokenExpiresAt || connection.tokenExpiresAt.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;
  if (!expiresSoon) return connection.accessToken;

  const res = await fetch(
    `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(connection.accessToken)}`,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    // A refresh hiccup doesn't necessarily mean the current token is dead
    // — let the publish call itself surface the real error instead of
    // blocking here.
    return connection.accessToken;
  }

  const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  await prisma.socialConnection.update({
    data: { accessToken: data.access_token, tokenExpiresAt },
    where: { id: connectionId },
  });
  return data.access_token as string;
}

export async function publishThreadsVideo(opts: {
  accessToken: string;
  threadsUserId: string;
  videoUrl: string;
  text?: string;
}): Promise<{ id: string; url: string }> {
  const initRes = await fetch(`https://graph.threads.net/v1.0/${opts.threadsUserId}/threads`, {
    body: new URLSearchParams({
      access_token: opts.accessToken,
      media_type: "VIDEO",
      text: opts.text ?? "",
      video_url: opts.videoUrl,
    }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const initData = await initRes.json().catch(() => null);
  const containerId = initData?.id;
  if (!initRes.ok || !containerId) {
    throw new ThreadsApiError(`Threads rejected the video: ${initData?.error?.message ?? initRes.status}`);
  }

  let status = "IN_PROGRESS";
  let attempts = 0;
  while (status === "IN_PROGRESS" && attempts < 15) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const statusRes = await fetch(
      `https://graph.threads.net/v1.0/${containerId}?fields=status&access_token=${encodeURIComponent(opts.accessToken)}`,
    );
    const statusData = await statusRes.json().catch(() => null);
    status = statusData?.status ?? "ERROR";
    attempts += 1;
  }
  if (status !== "FINISHED") {
    throw new ThreadsApiError(`Threads couldn't process the video (status: ${status}).`);
  }

  const publishRes = await fetch(`https://graph.threads.net/v1.0/${opts.threadsUserId}/threads_publish`, {
    body: new URLSearchParams({ access_token: opts.accessToken, creation_id: containerId }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
  const publishData = await publishRes.json().catch(() => null);
  const mediaId = publishData?.id;
  if (!publishRes.ok || !mediaId) {
    throw new ThreadsApiError(`Threads rejected the publish: ${publishData?.error?.message ?? publishRes.status}`);
  }

  const permalinkRes = await fetch(
    `https://graph.threads.net/v1.0/${mediaId}?fields=permalink&access_token=${encodeURIComponent(opts.accessToken)}`,
  );
  const permalinkData = await permalinkRes.json().catch(() => null);

  return {
    id: mediaId as string,
    url: (permalinkData?.permalink as string | undefined) ?? "https://www.threads.net/",
  };
}
