import { prisma } from "@/lib/prisma";

// Shared by both the direct OAuth callback path and the Facebook/Instagram
// Page-picker's select-page route. Matches by the platform's own account
// id when given, scoped to the same owner — accountName is display text
// and can change on the platform without this connection changing, and two
// different owners (a Brand Space and the admin pool, say) connecting the
// same underlying platform account must stay separate rows.
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
  brandSpaceId?: string;
}) {
  const existing = opts.platformAccountId
    ? await prisma.socialConnection.findFirst({
        where: {
          brandSpaceId: opts.brandSpaceId ?? null,
          platform: opts.platform,
          platformAccountId: opts.platformAccountId,
        },
      })
    : await prisma.socialConnection.findFirst({
        where: { accountName: opts.accountName, brandSpaceId: opts.brandSpaceId ?? null, platform: opts.platform },
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
      brandSpaceId: opts.brandSpaceId,
      platform: opts.platform,
      platformAccountId: opts.platformAccountId,
      profileImage: opts.profileImage,
      refreshToken: opts.refreshToken,
      role: opts.role,
      tokenExpiresAt: opts.tokenExpiresAt,
    },
  });
}
