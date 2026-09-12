import { NextResponse } from "next/server";

import { withDepCutAuth, type DepCutAuthenticatedRequest } from "@/lib/depcut-api-auth";
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { oauthPopupHtml } from "@/lib/marketplace/oauth-popup-html";
import { generatePkcePair, signOAuthState } from "@/lib/marketplace/oauth-state";
import { prisma } from "@/lib/prisma";
import { isStudioManager } from "@/lib/space/studio-access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; platform: string }> };

// Managers only. Opened in a popup window from a Studio's Repurpose
// settings. Redirects to the platform's real OAuth authorize screen using
// the same App ID/Secret the admin flow uses (Settings → OAuth App is one
// shared app registration per platform) — the resulting connection is
// scoped to this Studio via the signed state's ownerType, read by the
// shared callback route at /api/admin/oauth/[platform]/callback (that
// path is fixed: it's what's registered as the redirect URI with every
// platform, so a Studio connection has to land there too).
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, platform } = await context.params;
  if (!(await isStudioManager(request.depcut.userId, id))) {
    return oauthPopupHtml({
      message: "You're not a manager of this space.",
      success: false,
      title: "Forbidden",
    });
  }

  const provider = getOAuthProvider(platform);
  if (!provider) {
    return oauthPopupHtml({
      message: `"${platform}" doesn't support live OAuth connect.`,
      success: false,
      title: "Not supported",
    });
  }

  const config = await prisma.socialAppConfig.findUnique({ where: { platform } });
  const credentials = (config?.credentials as Record<string, string> | null) ?? {};
  const clientId = credentials[provider.clientIdField];
  if (!clientId) {
    return oauthPopupHtml({
      message: `${platform} isn't configured on DepCut yet — try again later.`,
      success: false,
      title: "App not configured",
    });
  }

  const redirectUri = `${new URL(request.url).origin}/api/admin/oauth/${platform}/callback`;
  const pkce = provider.usesPkce ? generatePkcePair() : null;
  const state = signOAuthState({
    studioId: id,
    ownerType: "studio",
    platform,
    role: "destination",
    verifier: pkce?.verifier,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: provider.scope,
    state,
    ...(provider.extraAuthorizeParams ?? {}),
  });
  if (pkce) {
    params.set("code_challenge", pkce.challenge);
    params.set("code_challenge_method", "S256");
  }

  return NextResponse.redirect(`${provider.authorizeUrl}?${params.toString()}`);
});
