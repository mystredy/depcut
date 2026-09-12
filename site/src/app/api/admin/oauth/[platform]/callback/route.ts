import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import {
  exchangeForLongLivedUserToken,
  fetchConnectableCandidates,
  MetaPagesError,
} from "@/lib/marketplace/meta-pages";
import { oauthPagePickerHtml, oauthPopupHtml } from "@/lib/marketplace/oauth-popup-html";
import { signPageState } from "@/lib/marketplace/oauth-page-state";
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { verifyOAuthState } from "@/lib/marketplace/oauth-state";
import { upsertSocialConnection } from "@/lib/marketplace/social-connection-upsert";
import { exchangeForLongLivedThreadsToken, ThreadsApiError } from "@/lib/marketplace/threads-api";
import { prisma } from "@/lib/prisma";
import { isStudioManager } from "@/lib/space/studio-access";

const META_PICKER_PLATFORMS = new Set(["facebook", "instagram"]);

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ platform: string }> };

type TokenResult = { accessToken: string; refreshToken?: string; expiresIn?: number };

async function exchangeCode(opts: {
  provider: NonNullable<ReturnType<typeof getOAuthProvider>>;
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  verifier?: string;
}): Promise<TokenResult | null> {
  const { provider, code, clientId, clientSecret, redirectUri, verifier } = opts;

  if (provider.tokenAuthStyle === "meta_get") {
    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    const res = await fetch(`${provider.tokenUrl}?${params.toString()}`);
    const data = await res.json().catch(() => null);
    if (!data?.access_token) return null;
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  }

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    ...(verifier ? { code_verifier: verifier } : {}),
  });
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };

  if (provider.tokenAuthStyle === "form_post_basic_auth") {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
  }

  const res = await fetch(provider.tokenUrl, { body, headers, method: "POST" });
  const data = await res.json().catch(() => null);
  if (!data?.access_token) return null;
  return { accessToken: data.access_token, expiresIn: data.expires_in, refreshToken: data.refresh_token };
}

// Reached via a top-level browser navigation from the platform's own
// domain — normal OAuth redirect, not a fetch, so our first-party session
// cookie still rides along. Shared by two flows, distinguished by the
// signed state's ownerType: an admin connecting the shared brand pool
// (super-user only), or a Studio manager connecting that space's own
// Repurpose destination. Both need the exact same redirect URI already
// registered with each platform, which is why this one route serves both
// instead of two separate callback paths.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { platform } = await context.params;
  const provider = getOAuthProvider(platform);
  if (!provider) {
    return oauthPopupHtml({ message: `Unknown platform "${platform}".`, success: false, title: "Not supported" });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (oauthError) {
    return oauthPopupHtml({ message: oauthError, success: false, title: "Connection cancelled" });
  }
  if (!code || !stateParam) {
    return oauthPopupHtml({ message: "Missing authorization code.", success: false, title: "Connection failed" });
  }

  const state = verifyOAuthState(stateParam);
  if (!state || state.platform !== platform) {
    return oauthPopupHtml({
      message: "This link expired or was tampered with — try connecting again.",
      success: false,
      title: "Invalid request",
    });
  }

  if (state.ownerType === "studio" && state.studioId) {
    if (!(await isStudioManager(request.depcut.userId, state.studioId))) {
      return oauthPopupHtml({
        message: "You're not a manager of this space.",
        success: false,
        title: "Forbidden",
      });
    }
  } else if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return oauthPopupHtml({ message: "Only super users can do this.", success: false, title: "Forbidden" });
  }

  const config = await prisma.socialAppConfig.findUnique({ where: { platform } });
  const credentials = (config?.credentials as Record<string, string> | null) ?? {};
  const clientId = credentials[provider.clientIdField];
  const clientSecret = credentials[provider.clientSecretField];
  if (!clientId || !clientSecret) {
    return oauthPopupHtml({
      message: `${platform}'s App ID/Secret aren't configured under Settings → OAuth App.`,
      success: false,
      title: "App not configured",
    });
  }

  const redirectUri = `${url.origin}/api/admin/oauth/${platform}/callback`;
  const token = await exchangeCode({
    clientId,
    clientSecret,
    code,
    provider,
    redirectUri,
    verifier: state.verifier,
  });
  if (!token) {
    return oauthPopupHtml({
      message: "The platform rejected the authorization code. Try again.",
      success: false,
      title: "Connection failed",
    });
  }

  const studioId = state.ownerType === "studio" ? state.studioId : undefined;

  // Facebook/Instagram post through a Page's own access token, not the
  // user token OAuth just returned — resolve which Page(s) this account
  // manages (Instagram further needs the Business Account linked to that
  // Page) and either auto-select the only candidate or show a picker.
  if (META_PICKER_PLATFORMS.has(platform)) {
    try {
      const longLived = await exchangeForLongLivedUserToken({
        clientId,
        clientSecret,
        shortLivedToken: token.accessToken,
      });
      const candidates = await fetchConnectableCandidates(
        platform as "facebook" | "instagram",
        longLived.accessToken,
      );

      if (candidates.length === 0) {
        return oauthPopupHtml({
          message:
            platform === "facebook"
              ? "This account doesn't manage any Facebook Pages."
              : "None of this account's Facebook Pages have a linked Instagram Business Account.",
          success: false,
          title: "No Pages found",
        });
      }

      if (candidates.length === 1) {
        const [page] = candidates;
        await upsertSocialConnection({
          accessToken: page.accessToken,
          accountName: state.label || page.name,
          studioId,
          platform,
          platformAccountId: page.id,
          profileImage: page.profileImage,
          role: state.role,
          tokenExpiresAt: longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000) : null,
        });
        return oauthPopupHtml({
          message: `${state.label || page.name} is now connected.`,
          success: true,
          title: "Connected",
        });
      }

      const pageState = signPageState({
        studioId,
        label: state.label,
        ownerType: state.ownerType,
        pages: candidates,
        platform,
        role: state.role,
      });
      return oauthPagePickerHtml({
        pages: candidates,
        selectUrl: `${url.origin}/api/admin/oauth/${platform}/select-page`,
        state: pageState,
        title: platform === "facebook" ? "Choose a Facebook Page" : "Choose an Instagram account",
      });
    } catch (error) {
      const message = error instanceof MetaPagesError ? error.message : "Couldn't resolve this account's Pages.";
      return oauthPopupHtml({ message, success: false, title: "Connection failed" });
    }
  }

  // Threads issues a short-lived token (~1 hour) from the code exchange —
  // upgrade it to a long-lived one (~60 days, itself refreshable) right
  // away so the stored token doesn't go stale almost immediately.
  let accessToken = token.accessToken;
  let refreshToken = token.refreshToken;
  let tokenExpiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null;
  if (platform === "threads") {
    try {
      const longLived = await exchangeForLongLivedThreadsToken({
        clientSecret,
        shortLivedToken: token.accessToken,
      });
      accessToken = longLived.accessToken;
      refreshToken = undefined;
      tokenExpiresAt = longLived.expiresIn ? new Date(Date.now() + longLived.expiresIn * 1000) : null;
    } catch (error) {
      const message = error instanceof ThreadsApiError ? error.message : "Couldn't get a long-lived Threads token.";
      return oauthPopupHtml({ message, success: false, title: "Connection failed" });
    }
  }

  const fetched = await provider.fetchProfile(accessToken).catch(() => ({
    accountHandle: undefined as string | undefined,
    accountName: `${provider.platform} Account`,
    platformAccountId: undefined as string | undefined,
    profileImage: undefined as string | undefined,
  }));
  const profile = { ...fetched, accountName: state.label || fetched.accountName };

  await upsertSocialConnection({
    accessToken,
    accountHandle: profile.accountHandle,
    accountName: profile.accountName,
    studioId,
    platform,
    platformAccountId: profile.platformAccountId,
    profileImage: profile.profileImage,
    refreshToken,
    role: state.role,
    tokenExpiresAt,
  });

  return oauthPopupHtml({
    message: `${profile.accountName} is now connected.`,
    success: true,
    title: "Connected",
  });
});
