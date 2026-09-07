import { prisma } from "@/lib/prisma";

// Flat per-account limit for My Space's posts. Not configurable yet — a
// single constant until there's a reason (a plan tier, an admin setting)
// to make it one.
export const SPACE_STORAGE_LIMIT_BYTES = 10 * 1024 ** 3;

/** Sum of every completed post's authoritative size for this account.
 * "pending"/"uploading" rows aren't counted — nothing landed yet, so
 * nothing should count against the quota. */
export async function spaceStorageUsedBytes(userId: string): Promise<number> {
  const result = await prisma.spacePost.aggregate({
    _sum: { sizeBytes: true },
    where: { status: "complete", userId },
  });
  return result._sum.sizeBytes ?? 0;
}
