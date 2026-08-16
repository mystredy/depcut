// The social platforms the future publish pipeline (Upload/Post in
// prisma/Marketplace.prisma) could push to. The SocialAppConfig table
// self-seeds one disabled row per platform from this list on first read;
// each platform's `fields` drives the admin credential form (which labels
// to show, and whether an input should be masked). Every field also mirrors
// into a real .env var (see SOCIAL_APP_ENV_VARS) — the env var is what any
// real provider reads, so it's the source of truth; the DB row exists so
// the admin form has something to show and edit, and to keep the last
// value saved through it even when nothing reads it yet.
export type SocialAppField = {
  key: string;
  label: string;
  type: "text" | "password";
  // Server-derived, not admin-entered — the form shows the saved value but
  // never lets it be typed into or sent back on save.
  readOnly?: boolean;
  // Shares one row with the field right after it instead of stacking —
  // see groupSocialAppFieldRows.
  pairWithNext?: boolean;
};

export type SocialAppSpec = {
  platform: string;
  label: string;
  description: string;
  fields: SocialAppField[];
  // This app's real OAuth callback route, if it has one — shown read-only
  // so the admin can paste the full URL (this origin + path) into the
  // provider's own console as the authorized redirect URI. Paired with
  // callbackEnvVar, PATCH /api/admin/social-apps/[id] mirrors the computed
  // URL into .env on every save, same as the credential fields.
  callbackPath?: string;
  callbackEnvVar?: string;
  // Numbered steps shown behind a "?" next to the form title — where to go
  // on the provider's own site to actually get these credentials.
  helpSteps?: string[];
};

export const SOCIAL_APP_SEED: SocialAppSpec[] = [
  {
    platform: "facebook",
    label: "Facebook",
    description: "OAuth 2.0 App ID and App Secret for Facebook API integration.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/facebook/callback",
    callbackEnvVar: "FACEBOOK_CALLBACK_URL",
    helpSteps: [
      "Go to Meta for Developers",
      "Create an App (Consumer)",
      "Enable Facebook Login and configure settings",
      "Add Valid OAuth Redirect URIs",
      "Copy App ID and App Secret from Settings → Basic",
    ],
  },
  {
    platform: "instagram",
    label: "Instagram",
    description: "OAuth 2.0 App ID and App Secret for Instagram Business accounts.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/instagram/callback",
    callbackEnvVar: "INSTAGRAM_CALLBACK_URL",
    helpSteps: [
      "Go to Meta for Developers",
      "Create an App (Business)",
      "Add the Instagram product and connect a Business account",
      "Add Valid OAuth Redirect URIs",
      "Copy App ID and App Secret from Settings → Basic",
    ],
  },
  {
    // The site's real "Sign in with Google" — see socialProviders.google in
    // src/lib/auth.ts, which reads GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET
    // directly from the environment. Unlike every other platform on this
    // page, saving here also mirrors into .env (see SOCIAL_APP_ENV_VARS) —
    // it's live, not storage for a future pipeline.
    platform: "google",
    label: "Google",
    description: "Client ID and Client Secret for Google Sign-In.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    // better-auth wires this route automatically for every configured
    // social provider — see socialProviders.google in src/lib/auth.ts.
    callbackPath: "/api/auth/callback/google",
    callbackEnvVar: "GOOGLE_REDIRECT_URI",
    helpSteps: [
      "Go to Google Cloud Console",
      "Create or select a project",
      "Configure the OAuth consent screen",
      "Create OAuth Client ID credentials (Web application)",
      "Add the Callback URL as an Authorized redirect URI",
      "Copy Client ID and Client Secret",
    ],
  },
  {
    platform: "x",
    label: "X",
    description: "OAuth 2.0 Client ID and Client Secret for the X API.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/x/callback",
    callbackEnvVar: "X_CALLBACK_URL",
    helpSteps: [
      "Go to the X Developer Portal",
      "Create a Project and App",
      "Enable OAuth 2.0 under User authentication settings",
      "Add the Callback URL as a Redirect URI",
      "Copy Client ID and Client Secret",
    ],
  },
  {
    platform: "snapchat",
    label: "Snapchat",
    description: "OAuth 2.0 Client ID and Client Secret for Snap Kit integration.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/snapchat/callback",
    callbackEnvVar: "SNAPCHAT_CALLBACK_URL",
    helpSteps: [
      "Go to the Snap Kit Developer Portal",
      "Create an app under My Apps",
      "Enable Login Kit",
      "Add the Callback URL as a Redirect URI",
      "Copy Client ID and Client Secret",
    ],
  },
  {
    platform: "threads",
    label: "Threads",
    description: "OAuth 2.0 App ID and App Secret for Threads API publishing.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/threads/callback",
    helpSteps: [
      "Go to Meta for Developers",
      "Create an App and add the Threads product",
      "Configure OAuth settings",
      "Add Valid OAuth Redirect URIs",
      "Copy App ID and App Secret from Settings → Basic",
    ],
  },
  {
    platform: "tiktok",
    label: "TikTok",
    description: "OAuth 2.0 App ID and App Secret for TikTok video publishing.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/tiktok/callback",
    callbackEnvVar: "TIKTOK_CALLBACK_URL",
    helpSteps: [
      "Go to TikTok for Developers",
      "Create an app under Manage Apps",
      "Add the Login Kit product",
      "Add the Callback URL as a Redirect URI",
      "Copy App ID and App Secret from the app's Basic Information",
    ],
  },
  {
    platform: "youtube",
    label: "YouTube",
    description: "OAuth 2.0 Client ID and Client Secret for video publishing permissions.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/youtube/callback",
    callbackEnvVar: "YOUTUBE_CALLBACK_URL",
    helpSteps: [
      "Go to Google Cloud Console",
      "Create or select a project and enable the YouTube Data API",
      "Configure the OAuth consent screen",
      "Create OAuth Client ID credentials (Web application)",
      "Add the Callback URL as an Authorized redirect URI",
      "Copy Client ID and Client Secret",
    ],
  },
  {
    platform: "youtube_shorts",
    label: "YouTube Shorts",
    description: "Separate OAuth 2.0 Client ID and Client Secret specific to Shorts.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
    callbackPath: "/api/admin/oauth/youtube_shorts/callback",
    callbackEnvVar: "YOUTUBE_SHORTS_CALLBACK_URL",
    helpSteps: [
      "Go to Google Cloud Console",
      "Create a second OAuth Client ID dedicated to Shorts",
      "Configure the OAuth consent screen if not already done",
      "Add the Callback URL as an Authorized redirect URI",
      "Copy Client ID and Client Secret",
    ],
  },
  {
    // The bot itself — token, derived identity, notification routing. Lives
    // on its own dedicated pages (/admin/telegram-bot/*), not the generic
    // OAuth App page, since it isn't an OAuth app. Telegram Login (verified
    // in src/app/api/auth/callback/telegram/route.ts, using this same bot
    // token as its signing key) has no admin UI of its own yet — no
    // callbackPath here on purpose, so the bot settings page stays just
    // the bot.
    platform: "telegram",
    label: "Telegram",
    description: "Configure administrative handles, bot webhooks, and client authorization credentials.",
    fields: [
      { key: "botToken", label: "Bot API Token", type: "password" },
      // Fetched from Telegram's getMe API using the token above — see
      // fetchTelegramBotInfo in src/lib/telegram/bot-info.ts, called from
      // PATCH /api/admin/social-apps/[id] whenever a new token is saved.
      { key: "botId", label: "Bot ID", type: "text", readOnly: true, pairWithNext: true },
      { key: "botUsername", label: "Bot Username", type: "text", readOnly: true },
      { key: "adminId", label: "Admin ID", type: "text", pairWithNext: true },
      { key: "adminUsername", label: "Admin Username", type: "text" },
      // The group/channel the bot posts notifications to (see
      // src/lib/telegram/notify.ts) — *Username is just a human-readable
      // label next to the *Id; Telegram addresses sendMessage by ID either
      // way, and a private group has no public username at all.
      { key: "groupId", label: "Group ID", type: "text", pairWithNext: true },
      { key: "groupUsername", label: "Group Username", type: "text" },
      { key: "channelId", label: "Channel ID", type: "text", pairWithNext: true },
      { key: "channelUsername", label: "Channel Username", type: "text" },
    ],
  },
];

// Which of this server's .env vars a platform's fields mirror — saving a
// credential in the admin panel also writes it here (see
// /api/admin/social-apps/[id], same pattern as API Integrations and Payment
// API), and any real consumer (see src/lib/auth.ts for Google, src/lib/
// telegram/notify.ts for the bot) reads the env var directly, not the DB.
// Telegram's bot vars reuse names the server's .env already reserved
// (TELEGRAM_BOT_*); every other name here is this codebase's own
// convention for a platform that has no reserved name yet.
export const SOCIAL_APP_ENV_VARS: Partial<Record<string, Partial<Record<string, string>>>> = {
  facebook: { appId: "FACEBOOK_APP_ID", appSecret: "FACEBOOK_APP_SECRET" },
  google: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
  instagram: { appId: "INSTAGRAM_APP_ID", appSecret: "INSTAGRAM_APP_SECRET" },
  snapchat: { clientId: "SNAPCHAT_API_KEY", clientSecret: "SNAPCHAT_API_SECRET" },
  telegram: {
    botToken: "TELEGRAM_BOT_TOKEN",
    botUsername: "TELEGRAM_BOT_USERNAME",
    botId: "TELEGRAM_BOT_ID",
    adminId: "TELEGRAM_ADMIN_ID",
    adminUsername: "TELEGRAM_ADMIN_USERNAME",
    groupId: "TELEGRAM_GROUP_ID",
    groupUsername: "TELEGRAM_GROUP_USERNAME",
    channelId: "TELEGRAM_CHANNEL_ID",
    channelUsername: "TELEGRAM_CHANNEL_USERNAME",
  },
  threads: { appId: "THREADS_APP_ID", appSecret: "THREADS_APP_SECRET" },
  tiktok: { appId: "TIKTOK_API_KEY", appSecret: "TIKTOK_API_SECRET" },
  x: { clientId: "X_API_KEY", clientSecret: "X_API_SECRET" },
  youtube: { clientId: "YOUTUBE_API_KEY", clientSecret: "YOUTUBE_API_SECRET" },
  youtube_shorts: {
    clientId: "YOUTUBE_SHORTS_API_KEY",
    clientSecret: "YOUTUBE_SHORTS_API_SECRET",
  },
};

// Groups a field explicitly marked pairWithNext onto one shared row with
// the field right after it, so the admin forms can render the pair side by
// side instead of stacking; every other field keeps its own row.
export function groupSocialAppFieldRows(fields: SocialAppField[]): SocialAppField[][] {
  const rows: SocialAppField[][] = [];
  for (let i = 0; i < fields.length; i++) {
    if (fields[i - 1]?.pairWithNext) {
      rows.at(-1)!.push(fields[i]);
    } else {
      rows.push([fields[i]]);
    }
  }
  return rows;
}
