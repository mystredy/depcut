import { prisma } from "@/lib/prisma";

export async function getBrandSpaceMembership(userId: string, brandSpaceId: string) {
  return prisma.brandSpaceMember.findUnique({
    where: { brandSpaceId_userId: { brandSpaceId, userId } },
  });
}

export async function isBrandSpaceManager(userId: string, brandSpaceId: string): Promise<boolean> {
  return (await getBrandSpaceMembership(userId, brandSpaceId)) != null;
}

export async function isBrandSpaceOwner(userId: string, brandSpaceId: string): Promise<boolean> {
  const member = await getBrandSpaceMembership(userId, brandSpaceId);
  return member?.role === "owner";
}

// Every mutation on a Brand Space's settings writes one of these — what the
// Management history section reads.
export async function logBrandSpaceActivity(opts: {
  brandSpaceId: string;
  actorId: string | null;
  action: string;
  detail?: string;
}): Promise<void> {
  await prisma.brandSpaceActivity.create({
    data: {
      action: opts.action,
      actorId: opts.actorId,
      brandSpaceId: opts.brandSpaceId,
      detail: opts.detail,
    },
  });
}
