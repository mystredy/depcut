import { apiKey } from "@better-auth/api-key";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";

import { DONKEYCUT_CANONICAL } from "@/cut/lib/hosts";
import { formatUsd } from "@/lib/credits/format-usd";
import { provisionSignupGrants } from "@/lib/onboarding/signup-grants";
import { prisma } from "@/lib/prisma";
import { notifyTelegram } from "@/lib/telegram/notify";

// Prefix for issued Vision API keys. The full secret is shown to the developer
// once at creation; only a hash is stored (handled by the apiKey plugin).
export const visionApiKeyPrefix = "dk_live_";

// donkeycut.com is the intended production host: the sign-in pages, the auth
// API, the Google OAuth callback, and the session are meant to all live on
// that one origin (the proxy 308s www. to the apex before anything serves),
// so auth cookies stay plain host-only cookies. Hosted deploys resolve
// baseURL per-request from this allowlist — it decides the OAuth
// redirect_uri — falling back to the canonical host for anything else, so an
// unrecognized Host header can never hijack a session. depcut.vercel.app is
// this fork's current deploy target; add a host here only after registering
// its OAuth redirect URI with the Google client too. Local dev leaves
// baseURL unset and better-auth derives it from the localhost request.
const baseURL = process.env.VERCEL
  ? { allowedHosts: ["donkeycut.com", "depcut.vercel.app"], fallback: DONKEYCUT_CANONICAL }
  : undefined;

// Best-effort admin alert for a new signup — never blocks account creation.
// Country reads Vercel's edge geo header (absent locally, so "Unknown" in
// dev); balance reads back the just-granted signup credit rather than
// hardcoding the amount, so the alert stays right if that ever changes.
async function notifyNewSignup(userId: string, name: string, headers: Headers | null): Promise<void> {
  try {
    const country = headers?.get("x-vercel-ip-country") ?? "Unknown";
    const account = await prisma.userCreditAccount.findUnique({
      select: { balanceMicros: true },
      where: { userId },
    });
    const balance = formatUsd(account ? String(Number(account.balanceMicros) / 1_000_000) : null);
    await notifyTelegram(
      "signup",
      `🆕 New user joined and requests approval.\n\n👤 Name: ${name}\ncountry: ${country}\nbalance: ${balance}`,
    );
  } catch (error) {
    // Best-effort — never let a notification failure affect signup. Logged
    // so a missed alert (e.g. the balance lookup above hitting a dropped DB
    // connection, before notifyTelegram is even reached) leaves a trace —
    // notifyTelegram's own errors are already logged inside notify.ts, but a
    // failure in this function's own prep work never reached that catch.
    console.error("[telegram] notifyNewSignup failed:", error);
  }
}

export const auth = betterAuth({
  baseURL,
  secret: process.env.BETTER_AUTH_SECRET,
  // Sessions last a year, and the rolling expiry is refreshed daily on use, so an active user
  // effectively never has to sign in again.
  session: {
    expiresIn: 60 * 60 * 24 * 365,
    updateAge: 60 * 60 * 24,
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  databaseHooks: {
    user: {
      create: {
        // Every new account is provisioned with its signup grants (app credits
        // + free Vision API calls). provisionSignupGrants is idempotent and
        // swallows its own errors, so it never blocks user creation.
        after: async (user, context) => {
          await provisionSignupGrants(user.id);
          await notifyNewSignup(user.id, user.name, context?.request?.headers ?? null);
        },
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Always show Google's account chooser: without this, a browser with one
      // signed-in Google session silently reuses the last-used account.
      prompt: "select_account",
    },
  },
  // The admin panel's per-platform "Enable" toggle (SocialAppConfig, see
  // /admin/settings/oauth-app) is otherwise just a label — betterAuth reads
  // its provider credentials straight from env at startup and has no
  // concept of a runtime on/off switch. This checks the DB flag right
  // before a social sign-in starts, so turning Google off here actually
  // blocks new sign-ins without touching env or restarting the server.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/social") return;
      const provider = ctx.body?.provider;
      if (!provider) return;
      const config = await prisma.socialAppConfig.findUnique({ where: { platform: provider } });
      if (config && !config.enabled) {
        throw new APIError("FORBIDDEN", { message: `${provider} sign-in is currently disabled.` });
      }
    }),
  },
  plugins: [
    apiKey({
      // We enforce our own monthly call quota and per-key rate limit on the
      // vision route, so the plugin's built-in rate limiting stays off.
      defaultPrefix: visionApiKeyPrefix,
      enableMetadata: true,
      rateLimit: {
        enabled: false,
      },
    }),
  ],
});
