// Real OAuth2 wiring for the "Connect" flow on /admin/social/connections.
// Each entry describes one platform's authorize/token endpoints and how to
// read its credentials from SocialAppConfig (see social-apps-seed.ts's field
// keys, which vary per platform). Telegram has no user-facing OAuth flow —
// it's bot-token based and stays a manual credential, not a "connection".
export type TokenAuthStyle = "meta_get" | "form_post" | "form_post_basic_auth";

export type OAuthProviderConfig = {
  platform: string;
  clientIdField: string;
  clientSecretField: string;
  authorizeUrl: string;
  tokenUrl: string;
  // Revokes the whole grant server-side (not just deletes our copy of the
  // token) so a disconnected account actually stops being usable at the
  // provider, not just in our DB. Optional — only set where the provider
  // has one; revocation on disconnect is best-effort where it exists.
  revokeUrl?: string;
  scope: string;
  usesPkce: boolean;
  tokenAuthStyle: TokenAuthStyle;
  extraAuthorizeParams?: Record<string, string>;
  fetchProfile: (accessToken: string) => Promise<{
    accountName: string;
    accountHandle?: string;
    platformAccountId?: string;
    profileImage?: string;
  }>;
};

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  facebook: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    clientIdField: "appId",
    clientSecretField: "appSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=name,picture&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return {
        accountName: data?.name ?? "Facebook Account",
        platformAccountId: data?.id,
        profileImage: data?.picture?.data?.url,
      };
    },
    platform: "facebook",
    scope: "pages_show_list,pages_manage_posts,pages_read_engagement",
    tokenAuthStyle: "meta_get",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    usesPkce: false,
  },
  instagram: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    clientIdField: "appId",
    clientSecretField: "appSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/me?fields=name,picture&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return {
        accountName: data?.name ?? "Instagram Account",
        platformAccountId: data?.id,
        profileImage: data?.picture?.data?.url,
      };
    },
    platform: "instagram",
    scope: "instagram_basic,pages_show_list",
    tokenAuthStyle: "meta_get",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    usesPkce: false,
  },
  threads: {
    authorizeUrl: "https://threads.net/oauth/authorize",
    clientIdField: "appId",
    clientSecretField: "appSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=username,threads_profile_picture_url&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return {
        accountHandle: data?.username ? `@${data.username}` : undefined,
        accountName: data?.username ?? "Threads Account",
        platformAccountId: data?.id,
        profileImage: data?.threads_profile_picture_url,
      };
    },
    platform: "threads",
    scope: "threads_basic,threads_content_publish",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    usesPkce: false,
  },
  tiktok: {
    authorizeUrl: "https://www.tiktok.com/v2/auth/authorize",
    clientIdField: "appId",
    clientSecretField: "appSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url,open_id",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await safeJson(res);
      return {
        accountName: data?.data?.user?.display_name ?? "TikTok Account",
        platformAccountId: data?.data?.user?.open_id,
        profileImage: data?.data?.user?.avatar_url,
      };
    },
    platform: "tiktok",
    scope: "user.info.profile,video.publish",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    usesPkce: true,
  },
  x: {
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    clientIdField: "clientId",
    clientSecretField: "clientSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await safeJson(res);
      return {
        accountHandle: data?.data?.username ? `@${data.data.username}` : undefined,
        accountName: data?.data?.name ?? "X Account",
        platformAccountId: data?.data?.id,
        profileImage: data?.data?.profile_image_url,
      };
    },
    platform: "x",
    scope: "tweet.read tweet.write users.read offline.access media.write",
    tokenAuthStyle: "form_post_basic_auth",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    usesPkce: true,
  },
  snapchat: {
    authorizeUrl: "https://accounts.snapchat.com/login/oauth2/authorize",
    clientIdField: "clientId",
    clientSecretField: "clientSecret",
    fetchProfile: async () => ({ accountName: "Snapchat Account" }),
    platform: "snapchat",
    scope: "snapchat-marketing-api",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://accounts.snapchat.com/login/oauth2/access_token",
    usesPkce: false,
  },
  youtube: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    clientIdField: "clientId",
    clientSecretField: "clientSecret",
    extraAuthorizeParams: { access_type: "offline", prompt: "consent" },
    fetchProfile: async (accessToken) => {
      const res = await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await safeJson(res);
      const channel = data?.items?.[0];
      return {
        accountHandle: channel?.snippet?.customUrl,
        accountName: channel?.snippet?.title ?? "YouTube Channel",
        platformAccountId: channel?.id,
        profileImage: channel?.snippet?.thumbnails?.default?.url,
      };
    },
    platform: "youtube",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    scope:
      "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/yt-analytics.readonly",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://oauth2.googleapis.com/token",
    usesPkce: false,
  },
};

export function getOAuthProvider(platform: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[platform] ?? null;
}

// The profile URL a connection's accountHandle resolves to, in the exact
// format each fetchProfile above actually produces it — Threads and YouTube
// keep the "@" in the URL, X strips it. Only threads/x/youtube ever set
// accountHandle (see fetchProfile above); everything else returns null so a
// caller never guesses at a URL scheme this file doesn't already know is
// right, rather than link somewhere wrong.
export function platformProfileUrl(platform: string, handle: string): string | null {
  switch (platform) {
    case "threads":
      return `https://www.threads.net/${handle}`;
    case "x":
      return `https://x.com/${handle.replace(/^@/, "")}`;
    case "youtube":
      return `https://www.youtube.com/${handle}`;
    default:
      return null;
  }
}

// Platforms with a real "Connect" flow — everything in SOCIAL_APP_SEED
// except Telegram, which is bot-token based, not OAuth.
export const OAUTH_CAPABLE_PLATFORMS = Object.keys(OAUTH_PROVIDERS);

// Platforms with real publish/analytics wiring (see
// src/lib/marketplace/youtube-api.ts) — split out from that file, which
// pulls in the Prisma client, so client components can read this list
// without bundling server-only code.
export const YOUTUBE_PLATFORMS = ["youtube"];

// Platforms with a real "Post video" publish path today (see
// /api/admin/social-connections/[id]/publish). Snapchat has no public API
// for posting to a connected account at all.
export const PUBLISHABLE_PLATFORMS = ["youtube", "tiktok", "x", "facebook", "instagram", "threads"];

// Platforms a studio workflow can use as an import *source* (destination =
// the studio itself) — the reverse of PUBLISHABLE_PLATFORMS. Deliberately
// much shorter: YouTube, TikTok, and Threads expose no official API for a
// creator's own uploaded video file at all (metadata/embed links only), and
// X gates its read API behind a paid tier. Instagram's Graph API returns a
// real, directly fetchable media_url for owned video content; Facebook's
// video `source` field does too, but only once Meta approves the relevant
// App Review for that permission — see facebook-api.ts's listFacebookVideos.
export const IMPORTABLE_PLATFORMS = ["instagram", "facebook"];

// A studio workflow's source can be the studio's own content (its Drops)
// instead of another connected platform. Represented as a real
// SocialConnection row (platform === this value, studioId set, no real
// OAuth token) so SocialWorkflow.sourceConnectionId — a required foreign
// key — never needs to allow null. lib/studio/access.ts creates that row
// lazily the first time a studio picks itself as a source; the studio
// settings UI filters this platform out of the Connections tab and treats
// this exact id as the "This studio" option in the New workflow dialog.
export const STUDIO_SOURCE_PLATFORM = "studio";
export const STUDIO_SOURCE_CONNECTION_ID = "studio";

// Whether a connection can actually be used for a live automated action
// ("Repurpose new posts") right now: still holds a token and isn't marked
// inactive. A short-lived access token past its tokenExpiresAt is still
// usable as long as a refresh token is on file — getValidAccessToken
// (oauth-token-refresh.ts) refreshes it transparently on next use, and
// flips status to "inactive" itself if that refresh ever fails. Only a
// connection with no refresh token (the Meta family, which issues
// long-lived tokens instead — see oauth-token-refresh.ts) actually needs
// its own tokenExpiresAt to still be in the future.
export function isConnectionUsable(connection: {
  status: string;
  hasToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string | Date | null;
}): boolean {
  if (!connection.hasToken || connection.status !== "active") return false;
  if (connection.hasRefreshToken || !connection.tokenExpiresAt) return true;
  return new Date(connection.tokenExpiresAt).getTime() > Date.now();
}
