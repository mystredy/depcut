import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { oauthPopupHtml } from "@/lib/marketplace/oauth-popup-html";
import { verifyPageState } from "@/lib/marketplace/oauth-page-state";
import { upsertSocialConnection } from "@/lib/marketplace/social-connection-upsert";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ platform: string }> };

// Super-user only. The Facebook/Instagram Page-picker's follow-up: the
// admin clicked one of the Pages listed by the callback route, and this
// finalizes that choice into a real SocialConnection using the chosen
// Page's own access token (verified from the signed state, not trusted
// from the request directly).
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return oauthPopupHtml({ message: "Only super users can do this.", success: false, title: "Forbidden" });
  }

  const { platform } = await context.params;
  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state");
  const pageId = url.searchParams.get("pageId");

  if (!stateParam || !pageId) {
    return oauthPopupHtml({ message: "Missing selection.", success: false, title: "Connection failed" });
  }

  const state = verifyPageState(stateParam);
  if (!state || state.platform !== platform) {
    return oauthPopupHtml({
      message: "This link expired or was tampered with — try connecting again.",
      success: false,
      title: "Invalid request",
    });
  }

  const page = state.pages.find((candidate) => candidate.id === pageId);
  if (!page) {
    return oauthPopupHtml({ message: "That option wasn't in the original list.", success: false, title: "Invalid request" });
  }

  await upsertSocialConnection({
    accessToken: page.accessToken,
    accountName: state.label || page.name,
    platform,
    platformAccountId: page.id,
    profileImage: page.profileImage,
    role: state.role,
    // Page tokens derived from a long-lived user token are effectively
    // non-expiring in practice; there's no per-Page expiry from this call
    // to store, so leave it unset. The admin reconnects if Meta ever
    // invalidates it (a password change, deauth, or periodic re-verification).
    tokenExpiresAt: null,
  });

  return oauthPopupHtml({
    message: `${state.label || page.name} is now connected.`,
    success: true,
    title: "Connected",
  });
});
