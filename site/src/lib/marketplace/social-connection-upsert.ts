import { prisma } from "@/lib/prisma";

// Shared by both the direct OAuth callback path and the Facebook/Instagram
// Page-picker's select-page route. Matches by the platform's own account
// id when given, scoped to the same owner — accountName is display text
// and can change on the platform without this connection changing, and two
// different owners (a studio and the admin pool, say) connecting the same
// underlying platform account must stay separate rows.
export async function upsertSocialConnection(opts: {
  platform: string;
  role: "source" | "destination";
  accountName: string;
  accountHandle?: string;
  platformAccountId?: string;
  profileImage?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date | null;
  studioId?: string;
}) {
  const existing = opts.platformAccountId
    ? await prisma.socialConnection.findFirst({
        where: {
          platform: opts.platform,
          platformAccountId: opts.platformAccountId,
          studioId: opts.studioId ?? null,
        },
      })
    : await prisma.socialConnection.findFirst({
        where: { accountName: opts.accountName, platform: opts.platform, studioId: opts.studioId ?? null },
      });

  if (existing) {
    return prisma.socialConnection.update({
      data: {
        accessToken: opts.accessToken,
        accountHandle: opts.accountHandle,
        platformAccountId: opts.platformAccountId,
        profileImage: opts.profileImage,
        refreshToken: opts.refreshToken,
        status: "active",
        tokenExpiresAt: opts.tokenExpiresAt,
      },
      where: { id: existing.id },
    });
  }

  return prisma.socialConnection.create({
    data: {
      accessToken: opts.accessToken,
      accountHandle: opts.accountHandle,
      accountName: opts.accountName,
      platform: opts.platform,
      platformAccountId: opts.platformAccountId,
      profileImage: opts.profileImage,
      refreshToken: opts.refreshToken,
      role: opts.role,
      studioId: opts.studioId,
      tokenExpiresAt: opts.tokenExpiresAt,
    },
  });
}
