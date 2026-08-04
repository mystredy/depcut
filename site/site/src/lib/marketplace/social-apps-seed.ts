// The social platforms the future publish pipeline (Upload/Post in
// prisma/Marketplace.prisma) could push to. The SocialAppConfig table
// self-seeds one disabled row per platform from this list on first read;
// each platform's `fields` drives the admin credential form (which labels
// to show, and whether an input should be masked).
export type SocialAppField = {
  key: string;
  label: string;
  type: "text" | "password";
};

export type SocialAppSpec = {
  platform: string;
  label: string;
  description: string;
  fields: SocialAppField[];
};

export const SOCIAL_APP_SEED: SocialAppSpec[] = [
  {
    platform: "facebook",
    label: "Facebook",
    description: "Configure authentication and webhook listeners for Facebook API integration.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
  },
  {
    platform: "instagram",
    label: "Instagram",
    description: "Configure access tokens and callback handlers for Instagram Business accounts.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "webhookSecret", label: "Webhook Secret", type: "password" },
    ],
  },
  {
    platform: "x",
    label: "X",
    description: "Configure developer credentials for the X API and post automation hooks.",
    fields: [
      { key: "apiKey", label: "API Key", type: "password" },
      { key: "apiSecret", label: "API Secret", type: "password" },
      { key: "accessToken", label: "Access Token", type: "password" },
      { key: "accessTokenSecret", label: "Access Token Secret", type: "password" },
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    platform: "snapchat",
    label: "Snapchat",
    description: "Configure Client ID and Client Secret for Snap Kit integration.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    platform: "threads",
    label: "Threads",
    description: "Configure App ID and App Secret for Threads API publishing.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appSecret", label: "App Secret", type: "password" },
    ],
  },
  {
    platform: "tiktok",
    label: "TikTok",
    description: "Control short-form video dispatch API and domain validation parameters.",
    fields: [
      { key: "appId", label: "App ID", type: "text" },
      { key: "appKey", label: "App Key", type: "password" },
      { key: "appSecret", label: "App Secret", type: "password" },
      { key: "verificationFile", label: "Verification File (filename)", type: "text" },
    ],
  },
  {
    platform: "youtube",
    label: "YouTube",
    description: "Control Google OAuth 2.0 client IDs for video publishing permissions.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    platform: "youtube_shorts",
    label: "YouTube Shorts",
    description: "Separate Google OAuth client credentials specific to Shorts.",
    fields: [
      { key: "clientId", label: "Client ID", type: "text" },
      { key: "clientSecret", label: "Client Secret", type: "password" },
    ],
  },
  {
    platform: "telegram",
    label: "Telegram",
    description: "Configure administrative handles, bot webhooks, and client authorization credentials.",
    fields: [
      { key: "botToken", label: "Bot API Token", type: "password" },
      { key: "adminUsername", label: "Admin Username", type: "text" },
      { key: "botUsername", label: "Bot Username", type: "text" },
    ],
  },
];
