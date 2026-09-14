import { STUDIO_SOURCE_PLATFORM } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";

export async function getStudioMembership(userId: string, studioId: string) {
  return prisma.studioMember.findUnique({
    where: { studioId_userId: { studioId, userId } },
  });
}

export async function isStudioManager(userId: string, studioId: string): Promise<boolean> {
  return (await getStudioMembership(userId, studioId)) != null;
}

export async function isStudioOwner(userId: string, studioId: string): Promise<boolean> {
  const member = await getStudioMembership(userId, studioId);
  return member?.role === "owner";
}

// A workflow's source can be the studio's own Drops instead of another
// connected platform. SocialWorkflow.sourceConnectionId is a required
// foreign key, so that's represented as a real SocialConnection row rather
// than null — created lazily the first time a studio uses itself as a
// source, and reused after that.
export async function ensureStudioSourceConnection(studioId: string) {
  const existing = await prisma.socialConnection.findFirst({
    where: { platform: STUDIO_SOURCE_PLATFORM, studioId },
  });
  if (existing) return existing;

  const studio = await prisma.studio.findUniqueOrThrow({ select: { name: true }, where: { id: studioId } });
  return prisma.socialConnection.create({
    data: {
      accountName: studio.name,
      platform: STUDIO_SOURCE_PLATFORM,
      role: "source",
      status: "active",
      studioId,
    },
  });
}

// Every mutation on a studio's settings writes one of these — what the
// Management history section reads.
export async function logStudioActivity(opts: {
  studioId: string;
  actorId: string | null;
  action: string;
  detail?: string;
}): Promise<void> {
  await prisma.studioActivity.create({
    data: {
      action: opts.action,
      actorId: opts.actorId,
      detail: opts.detail,
      studioId: opts.studioId,
    },
  });
}
