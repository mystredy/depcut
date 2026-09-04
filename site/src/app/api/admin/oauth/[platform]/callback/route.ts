import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { oauthPopupHtml } from "@/lib/marketplace/oauth-popup-html";
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { verifyOAuthState } from "@/lib/marketplace/oauth-state";
import { prisma } from "@/lib/prisma";

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

// Super-user only, but reached via a top-level browser navigation from the
// platform's own domain — normal OAuth redirect, not a fetch, so our
// first-party session cookie still rides along.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return oauthPopupHtml({ message: "Only super users can do this.", success: false, title: "Forbidden" });
  }

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

  const fetched = await provider
    .fetchProfile(token.accessToken)
    .catch(() => ({ accountHandle: undefined as string | undefined, accountName: `${provider.platform} Account` }));
  const profile = { ...fetched, accountName: state.label || fetched.accountName };

  const tokenExpiresAt = token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null;

  const existing = await prisma.socialConnection.findFirst({
    where: { accountName: profile.accountName, platform },
  });
  if (existing) {
    await prisma.socialConnection.update({
      data: {
        accessToken: token.accessToken,
        accountHandle: profile.accountHandle,
        refreshToken: token.refreshToken,
        status: "active",
        tokenExpiresAt,
      },
      where: { id: existing.id },
    });
  } else {
    await prisma.socialConnection.create({
      data: {
        accessToken: token.accessToken,
        accountHandle: profile.accountHandle,
        accountName: profile.accountName,
        platform,
        refreshToken: token.refreshToken,
        role: state.role,
        tokenExpiresAt,
      },
    });
  }

  return oauthPopupHtml({
    message: `${profile.accountName} is now connected.`,
    success: true,
    title: "Connected",
  });
});
