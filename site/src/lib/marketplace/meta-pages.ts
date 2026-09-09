// Resolves the Facebook Pages a connected user manages, and the Instagram
// Business Account linked to a Page — the piece Facebook/Instagram
// publishing actually needs, since posting requires a Page's own access
// token, not the user token OAuth hands back. Used by the OAuth callback
// route's Page-picker step (see oauth-page-state.ts).
import type { CandidatePage } from "@/lib/marketplace/oauth-page-state";
import { prisma } from "@/lib/prisma";

export class MetaPagesError extends Error {}

// Facebook/Instagram Page tokens don't come with a refresh_token — Meta
// issues them long-lived (effectively non-expiring in practice) from the
// Page-picker's one-time long-lived-token exchange instead. So there's
// nothing to refresh here, just the stored token as-is; a connection Meta
// has since invalidated needs a fresh Connect, not a refresh.
export async function getStoredPageAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.accessToken) {
    throw new MetaPagesError("This connection has no stored access token — remove it and connect again.");
  }
  return connection.accessToken;
}

// The short-lived user token from the initial code exchange is upgraded to
// a long-lived one (~60 days) before fetching Pages, so the Page access
// tokens handed back inherit that longer lifetime instead of expiring in
// about an hour.
export async function exchangeForLongLivedUserToken(opts: {
  shortLivedToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiresIn: number | null }> {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    client_secret: opts.clientSecret,
    fb_exchange_token: opts.shortLivedToken,
    grant_type: "fb_exchange_token",
  });
  const res = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?${params.toString()}`);
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.access_token) {
    throw new MetaPagesError(`Facebook rejected the long-lived token exchange: ${data?.error?.message ?? res.status}`);
  }
  return { accessToken: data.access_token as string, expiresIn: data.expires_in ?? null };
}

export async function fetchManagedPages(longLivedUserToken: string): Promise<CandidatePage[]> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,picture&access_token=${encodeURIComponent(longLivedUserToken)}`,
  );
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new MetaPagesError(`Facebook rejected the Pages request: ${data?.error?.message ?? res.status}`);
  }
  const pages = (data?.data ?? []) as Array<{
    id: string;
    name: string;
    access_token: string;
    picture?: { data?: { url?: string } };
  }>;
  return pages.map((page) => ({
    accessToken: page.access_token,
    id: page.id,
    name: page.name,
    profileImage: page.picture?.data?.url,
  }));
}

export async function resolveInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string,
): Promise<{ id: string; username: string; profileImage?: string } | null> {
  const res = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(pageAccessToken)}`,
  );
  const data = await res.json().catch(() => null);
  const account = data?.instagram_business_account;
  if (!res.ok || !account?.id) return null;
  return {
    id: account.id as string,
    profileImage: account.profile_picture_url as string | undefined,
    username: (account.username as string | undefined) ?? "Instagram Account",
  };
}

// What the OAuth callback actually offers as connectable "accounts": every
// Page the user manages for Facebook, but only Pages with a linked
// Instagram Business Account for Instagram — the Page's access token is
// what publishing uses either way, since an IG Business Account has no
// OAuth token of its own.
export async function fetchConnectableCandidates(
  platform: "facebook" | "instagram",
  longLivedUserToken: string,
): Promise<CandidatePage[]> {
  const pages = await fetchManagedPages(longLivedUserToken);
  if (platform === "facebook") return pages;

  const resolved = await Promise.all(
    pages.map(async (page): Promise<CandidatePage | null> => {
      const account = await resolveInstagramBusinessAccount(page.id, page.accessToken);
      if (!account) return null;
      return {
        accessToken: page.accessToken,
        id: account.id,
        name: account.username,
        profileImage: account.profileImage,
      };
    }),
  );
  return resolved.filter((candidate): candidate is CandidatePage => candidate !== null);
}
