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
  scope: string;
  usesPkce: boolean;
  tokenAuthStyle: TokenAuthStyle;
  extraAuthorizeParams?: Record<string, string>;
  fetchProfile: (accessToken: string) => Promise<{ accountName: string; accountHandle?: string }>;
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
        `https://graph.facebook.com/v21.0/me?fields=name&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return { accountName: data?.name ?? "Facebook Account" };
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
        `https://graph.facebook.com/v21.0/me?fields=name&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return { accountName: data?.name ?? "Instagram Account" };
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
        `https://graph.threads.net/v1.0/me?fields=username&access_token=${encodeURIComponent(accessToken)}`
      );
      const data = await safeJson(res);
      return { accountHandle: data?.username ? `@${data.username}` : undefined, accountName: data?.username ?? "Threads Account" };
    },
    platform: "threads",
    scope: "threads_basic",
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
        "https://open.tiktokapis.com/v2/user/info/?fields=display_name",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await safeJson(res);
      return { accountName: data?.data?.user?.display_name ?? "TikTok Account" };
    },
    platform: "tiktok",
    scope: "user.info.basic",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    usesPkce: true,
  },
  x: {
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    clientIdField: "clientId",
    clientSecretField: "clientSecret",
    fetchProfile: async (accessToken) => {
      const res = await fetch("https://api.twitter.com/2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await safeJson(res);
      return {
        accountHandle: data?.data?.username ? `@${data.data.username}` : undefined,
        accountName: data?.data?.name ?? "X Account",
      };
    },
    platform: "x",
    scope: "tweet.read users.read offline.access",
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
      };
    },
    platform: "youtube",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://oauth2.googleapis.com/token",
    usesPkce: false,
  },
  youtube_shorts: {
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
        accountName: channel?.snippet?.title ?? "YouTube Shorts Channel",
      };
    },
    platform: "youtube_shorts",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    tokenAuthStyle: "form_post",
    tokenUrl: "https://oauth2.googleapis.com/token",
    usesPkce: false,
  },
};

export function getOAuthProvider(platform: string): OAuthProviderConfig | null {
  return OAUTH_PROVIDERS[platform] ?? null;
}

// Platforms with a real "Connect" flow — everything in SOCIAL_APP_SEED
// except Telegram, which is bot-token based, not OAuth.
export const OAUTH_CAPABLE_PLATFORMS = Object.keys(OAUTH_PROVIDERS);
