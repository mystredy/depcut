// Standard OAuth2 refresh_token grant, shared by every provider that uses
// it (Google, TikTok, X) — reads the provider's own tokenAuthStyle to pick
// body-credential vs Basic-auth refresh, same branching as the initial code
// exchange in the OAuth callback route. NOT for the Meta family (Facebook,
// Instagram, Threads): those issue long-lived tokens refreshed through a
// different, platform-specific call, not this grant type.
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";

export class SocialConnectionError extends Error {}

export async function getValidAccessToken(connectionId: string): Promise<string> {
  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection) throw new SocialConnectionError("Connection not found.");

  const expiresSoon =
    !connection.accessToken ||
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (!expiresSoon) return connection.accessToken!;

  if (!connection.refreshToken) {
    throw new SocialConnectionError(
      "This connection has no refresh token on file — remove it and connect again.",
    );
  }

  const provider = getOAuthProvider(connection.platform);
  if (!provider) throw new SocialConnectionError(`Unknown platform "${connection.platform}".`);

  const config = await prisma.socialAppConfig.findUnique({ where: { platform: connection.platform } });
  const credentials = (config?.credentials as Record<string, string> | null) ?? {};
  const clientId = credentials[provider.clientIdField];
  const clientSecret = credentials[provider.clientSecretField];
  if (!clientId || !clientSecret) {
    throw new SocialConnectionError(
      `${connection.platform}'s App ID/Secret aren't configured under Settings → OAuth App.`,
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: connection.refreshToken,
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
  if (!res.ok || !data?.access_token) {
    await prisma.socialConnection.update({ data: { status: "inactive" }, where: { id: connectionId } });
    throw new SocialConnectionError(
      "The platform rejected the token refresh — remove this connection and connect again.",
    );
  }

  const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
  await prisma.socialConnection.update({
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? connection.refreshToken,
      status: "active",
      tokenExpiresAt,
    },
    where: { id: connectionId },
  });

  return data.access_token as string;
}
