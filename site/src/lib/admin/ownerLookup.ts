import { prisma } from "@/lib/prisma";

export type Owner = { id: string; name: string; displayName: string | null; email: string; image: string | null };

/** Batch-resolve owner display info for a list of content rows that only
 * carry a plain userId (CutProject, FlowGeneration, AudioGeneration — all
 * deliberately self-contained, no FK to User, see their own schema files).
 * One query for the whole page instead of one per row. */
export async function lookupOwners(userIds: string[]): Promise<Map<string, Owner>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, displayName: true, email: true, image: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}
