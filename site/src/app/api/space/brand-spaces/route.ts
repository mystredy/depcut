import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth, type DepCutAuthenticatedRequest } from "@/lib/depcut-api-auth";
import { Prisma } from "@/generated/prisma/client";
import { validationErrorResponse } from "@/lib/inference/responses";
import { logBrandSpaceActivity } from "@/lib/space/brand-space-access";
import { prisma } from "@/lib/prisma";
import { usernameSchema } from "@/lib/username";

export const dynamic = "force-dynamic";

/** True for a Prisma unique-constraint violation — same pattern
 * api/account/profile/route.ts uses for its own username uniqueness. */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Every Brand Space this account manages (owner or invited manager) — the
// switcher on /app/space reads this list.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const memberships = await prisma.brandSpaceMember.findMany({
    include: { brandSpace: true },
    orderBy: { createdAt: "asc" },
    where: { userId: request.depcut.userId },
  });

  return NextResponse.json({
    spaces: memberships.map((m) => ({
      avatarImageKey: m.brandSpace.avatarImageKey,
      id: m.brandSpace.id,
      name: m.brandSpace.name,
      role: m.role,
      spaceType: m.brandSpace.spaceType,
      username: m.brandSpace.username,
    })),
  });
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  spaceType: z.string().trim().min(1).max(40).default("Creator"),
  username: usernameSchema,
});

// Creates the space and seeds its owner's BrandSpaceMember row in one
// transaction — a space with no owner member would be unmanageable the
// instant it's created.
export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const userId = request.depcut.userId;

  try {
    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.brandSpace.create({
        data: {
          name: parsed.data.name,
          ownerId: userId,
          spaceType: parsed.data.spaceType,
          username: parsed.data.username,
        },
      });
      await tx.brandSpaceMember.create({
        data: { brandSpaceId: created.id, role: "owner", userId },
      });
      return created;
    });

    await logBrandSpaceActivity({
      action: "Created the space",
      actorId: userId,
      brandSpaceId: space.id,
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
