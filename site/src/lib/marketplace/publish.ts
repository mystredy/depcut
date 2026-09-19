import { publishFacebookVideo, FacebookApiError } from "@/lib/marketplace/facebook-api";
import { publishInstagramVideo, InstagramApiError } from "@/lib/marketplace/instagram-api";
import { getStoredPageAccessToken, MetaPagesError } from "@/lib/marketplace/meta-pages";
import { PUBLISHABLE_PLATFORMS } from "@/lib/marketplace/oauth-providers";
import { getValidAccessToken, SocialConnectionError } from "@/lib/marketplace/oauth-token-refresh";
import { getValidThreadsAccessToken, publishThreadsVideo, ThreadsApiError } from "@/lib/marketplace/threads-api";
import { publishTiktokVideo, TiktokApiError } from "@/lib/marketplace/tiktok-api";
import { publishXPost, XApiError } from "@/lib/marketplace/x-api";
import { publishYoutubeVideo, YoutubeApiError } from "@/lib/marketplace/youtube-api";
import { prisma } from "@/lib/prisma";

// Facebook/Instagram Page tokens have no refresh_token grant at all (see
// meta-pages.ts) — read as stored, not refreshed. Threads has its own
// long-lived-token refresh, distinct from the standard OAuth2 grant the
// remaining platforms use — see oauth-token-refresh.ts vs threads-api.ts.
const META_PLATFORMS = new Set(["facebook", "instagram"]);

export class PublishError extends Error {}

export type PublishOptions = {
  videoUrl?: string;
  title: string;
  description?: string;
  // YouTube-only — its video resource has a real structured tags field
  // (snippet.tags); the other platforms have no equivalent, so this is
  // simply unused for them.
  tags?: string[];
  privacyStatus?: "public" | "unlisted" | "private";
};

export type PublishResult = { id?: string; videoId?: string; publishId?: string; url?: string };

// Dispatches to the right platform's publish call for a SocialConnection —
// shared by the admin's manual "Post video" action and a studio workflow's
// automatic publish on Drop completion. A superset of every platform's
// fields; callers pass what they have, and this picks what each platform
// actually needs. Wraps every platform-specific error (and a missing/
// unsupported connection) into PublishError so callers only need one catch.
export async function publishToConnection(connectionId: string, opts: PublishOptions): Promise<PublishResult> {
  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new PublishError("Connection not found.");
  if (!PUBLISHABLE_PLATFORMS.includes(connection.platform)) {
    throw new PublishError(`Publishing isn't wired up for ${connection.platform} connections yet.`);
  }

  const { videoUrl, title, description, tags, privacyStatus = "unlisted" } = opts;

  try {
    const accessToken = META_PLATFORMS.has(connection.platform)
      ? await getStoredPageAccessToken(connectionId)
      : connection.platform === "threads"
        ? await getValidThreadsAccessToken(connectionId)
        : await getValidAccessToken(connectionId);

    if (connection.platform === "threads") {
      if (!videoUrl) throw new PublishError("videoUrl is required for Threads.");
      if (!connection.platformAccountId) {
        throw new PublishError("This connection predates the current Threads linking — remove it and connect again.");
      }
      return await publishThreadsVideo({ accessToken, text: title, threadsUserId: connection.platformAccountId, videoUrl });
    }

    if (connection.platform === "facebook" || connection.platform === "instagram") {
      if (!videoUrl) throw new PublishError(`videoUrl is required for ${connection.platform}.`);
      if (!connection.platformAccountId) {
        throw new PublishError("This connection predates Page linking — remove it and connect again.");
      }
      return connection.platform === "facebook"
        ? await publishFacebookVideo({ accessToken, description: title, pageId: connection.platformAccountId, videoUrl })
        : await publishInstagramVideo({ accessToken, caption: title, igUserId: connection.platformAccountId, videoUrl });
    }

    if (connection.platform === "youtube") {
      if (!videoUrl) throw new PublishError("videoUrl is required for YouTube.");
      return await publishYoutubeVideo({ accessToken, description, privacyStatus, tags, title, videoUrl });
    }

    if (connection.platform === "tiktok") {
      if (!videoUrl) throw new PublishError("videoUrl is required for TikTok.");
      return await publishTiktokVideo({ accessToken, caption: title, videoUrl });
    }

    if (connection.platform === "x") {
      return await publishXPost({ accessToken, text: title, videoUrl });
    }

    throw new PublishError(`No publish handler wired for ${connection.platform}.`);
  } catch (error) {
    if (error instanceof PublishError) throw error;
    if (
      error instanceof SocialConnectionError ||
      error instanceof YoutubeApiError ||
      error instanceof TiktokApiError ||
      error instanceof XApiError ||
      error instanceof FacebookApiError ||
      error instanceof InstagramApiError ||
      error instanceof MetaPagesError ||
      error instanceof ThreadsApiError
    ) {
      throw new PublishError(error.message);
    }
    throw error;
  }
}
