import { prisma } from "@/lib/prisma";

// The account as the product shows it, shared by every route that hands the
// profile back so the name and picture can't drift between them.
//
// `name` stays whatever the identity provider gave us at sign-in; `displayName`
// is the one the user chose. The picture is the uploaded one when there is one,
// addressed by a URL stamped with its `updatedAt` so a new upload busts the
// browser's cache, and the provider's hotlinked image otherwise. The
// background image URL is stamped with the row's own `updatedAt` instead of
// its own dedicated timestamp — any profile edit re-fetching it a beat early
// is a cheap, harmless trade against a fifth column just for that.
export async function accountProfile(userId: string) {
  const [user, avatar] = await Promise.all([
    prisma.user.findUnique({
      select: {
        backgroundImageKey: true,
        bio: true,
        displayName: true,
        email: true,
        image: true,
        location: true,
        name: true,
        showFollowerCount: true,
        updatedAt: true,
        username: true,
      },
      where: { id: userId },
    }),
    prisma.userAvatar.findUnique({
      select: { updatedAt: true },
      where: { userId },
    }),
  ]);
  if (!user) return null;

  return {
    backgroundImage: user.backgroundImageKey
      ? `/api/account/background-image?v=${user.updatedAt.getTime()}`
      : null,
    bio: user.bio,
    displayName: user.displayName,
    email: user.email,
    image: avatar ? `/api/account/avatar?v=${avatar.updatedAt.getTime()}` : user.image,
    location: user.location,
    name: user.name,
    showFollowerCount: user.showFollowerCount,
    username: user.username,
  };
}
