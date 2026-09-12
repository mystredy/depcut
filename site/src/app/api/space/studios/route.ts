import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth, type DepCutAuthenticatedRequest } from "@/lib/depcut-api-auth";
import { Prisma } from "@/generated/prisma/client";
import { validationErrorResponse } from "@/lib/inference/responses";
import { logStudioActivity } from "@/lib/space/studio-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** True for a Prisma unique-constraint violation — same pattern
 * api/account/profile/route.ts uses for its own username uniqueness. */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Every Studio this account manages (owner or invited manager) — the
// switcher on /app/space reads this list.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const memberships = await prisma.studioMember.findMany({
    include: { studio: true },
    orderBy: { createdAt: "asc" },
    where: { userId: request.depcut.userId },
  });

  return NextResponse.json({
    spaces: memberships.map((m) => ({
      avatarImageKey: m.studio.avatarImageKey,
      id: m.studio.id,
      name: m.studio.name,
      role: m.role,
      spaceType: m.studio.spaceType,
      username: m.studio.username,
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  spaceType: z.string().trim().min(1).max(40).default("Creator"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z0-9_]{2,19}$/, "3-20 characters: letters, numbers, underscores, starting with a letter"),
});

// Creates the space and seeds its owner's StudioMember row in one
// transaction — a space with no owner member would be unmanageable the
// instant it's created.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userId = request.depcut.userId;

  try {
    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.studio.create({
        data: {
          name: parsed.data.name,
          ownerId: userId,
          spaceType: parsed.data.spaceType,
          username: parsed.data.username,
        },
      });
      await tx.studioMember.create({
        data: { studioId: created.id, role: "owner", userId },
      });
      return created;
    });

    await logStudioActivity({
      action: "Created the space",
      actorId: userId,
      studioId: space.id,
    });

    return NextResponse.json({ space });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "username_taken", message: "That username is taken." },
        { status: 409 },
      );
    }
    throw error;
  }
});
