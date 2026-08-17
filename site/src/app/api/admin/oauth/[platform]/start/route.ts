import { NextResponse } from "next/server";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { generatePkcePair, signOAuthState } from "@/lib/marketplace/oauth-state";
import { prisma } from "@/lib/prisma";
import { oauthPopupHtml } from "@/lib/marketplace/oauth-popup-html";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ platform: string }> };

// Super-user only. Opened in a popup window from /admin/social/connections.
// Redirects to the platform's real OAuth authorize screen using the App
// ID/Secret stored in Settings > OAuth App (SocialAppConfig) — this route
// never asks for or sees the user's platform password, same as any OAuth
// flow.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return oauthPopupHtml({
      message: "Only super users can connect a social account.",
      success: false,
      title: "Forbidden",
    });
  }

  const { platform } = await context.params;
  const provider = getOAuthProvider(platform);
  if (!provider) {
    return oauthPopupHtml({
      message: `"${platform}" doesn't support live OAuth connect — add it manually instead.`,
      success: false,
      title: "Not supported",
    });
  }

  const searchParams = new URL(request.url).searchParams;
  const role = searchParams.get("role") === "source" ? "source" : "destination";
  const label = searchParams.get("name")?.trim().slice(0, 160) || undefined;

  const config = await prisma.socialAppConfig.findUnique({ where: { platform } });
  const credentials = (config?.credentials as Record<string, string> | null) ?? {};
  const clientId = credentials[provider.clientIdField];
  if (!clientId) {
    return oauthPopupHtml({
      message: `Add a "${provider.clientIdField}" for ${platform} under Settings → OAuth App first, then try connecting again.`,
      success: false,
      title: "App not configured",
    });
  }

  const redirectUri = `${new URL(request.url).origin}/api/admin/oauth/${platform}/callback`;
  const pkce = provider.usesPkce ? generatePkcePair() : null;
  const state = signOAuthState({ label, platform, role, verifier: pkce?.verifier });

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
