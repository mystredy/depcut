import { randomBytes } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";

// A Drop's id doubles as its share link (`/@handle?drop=<id>`), and for an
// unlisted drop that link is the only access gate (see canViewDrop) — so it
// has to stay short, the way YouTube's or Snapchat's own share ids do,
// rather than a long cuid. 8 random bytes, base64url: 11 characters, same
// length as a YouTube video id, with comparable (64-bit) guess resistance.
function newDropId(): string {
  return randomBytes(8).toString("base64url");
}

// Wraps a Drop-creating call with a short id, retrying on the vanishingly
// rare collision (P2002) rather than trusting a single draw. Existing drops
// keep their long cuid — this only changes what's generated going forward.
export async function createWithShortId<T>(create: (id: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await create(newDropId());
    } catch (e) {
      if (attempt < 2 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
  }
  // Unreachable — the loop above either returns or throws on its last attempt.
  throw new Error("Couldn't generate a unique drop id.");
}
