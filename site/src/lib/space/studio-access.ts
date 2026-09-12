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

// Every mutation on a Studio's settings writes one of these — what the
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
      studioId: opts.studioId,
      detail: opts.detail,
    },
  });
}
