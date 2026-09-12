import { NextResponse } from "next/server";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { validationErrorResponse } from "@/lib/inference/responses";
import { prisma } from "@/lib/prisma";
import { getBrandSpaceMembership, logBrandSpaceActivity } from "@/lib/space/brand-space-access";
import { usernameSchema } from "@/lib/username";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Any signed-in account can view a Brand Space's profile — same
// sign-in-required convention as the rest of Space (see /app/space's own
// SettingsGuard). isManager/role tell the page whether to show the
// Settings entry point.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const space = await prisma.brandSpace.findUnique({ where: { id } });
  if (!space) return notFoundResponse();

  const membership = await getBrandSpaceMembership(request.depcut.userId, id);

  return NextResponse.json({
    space: {
      avatarImageKey: space.avatarImageKey,
      backgroundImageKey: space.backgroundImageKey,
      bio: space.bio,
      id: space.id,
      linkedAccounts: space.linkedAccounts ?? {},
      name: space.name,
      role: membership?.role ?? null,
      spaceType: space.spaceType,
      username: space.username,
    },
  });
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(60).optional(),
    username: usernameSchema.optional(),
    bio: z.string().trim().max(150).nullable().optional(),
    spaceType: z.string().trim().min(1).max(40).optional(),
    linkedAccounts: z.record(z.string(), z.string().trim().max(160)).optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const changes: string[] = [];
  const data: Prisma.BrandSpaceUpdateInput = {};
  if (parsed.data.name !== undefined) {
    data.name = parsed.data.name;
    changes.push("name");
  }
  if (parsed.data.username !== undefined) {
    data.username = parsed.data.username;
    changes.push("username");
  }
  if ("bio" in parsed.data) {
    data.bio = parsed.data.bio || null;
    changes.push("bio");
  }
  if (parsed.data.spaceType !== undefined) {
    data.spaceType = parsed.data.spaceType;
    changes.push("space type");
  }
  if (parsed.data.linkedAccounts !== undefined) {
    data.linkedAccounts = parsed.data.linkedAccounts;
    changes.push("linked accounts");
  }

  if (changes.length === 0) {
    return NextResponse.json({ error: "Invalid request", message: "Nothing to update." }, { status: 400 });
  }

  try {
    const updated = await prisma.brandSpace.update({ data, where: { id } });
    await logBrandSpaceActivity({
      action: `Updated ${changes.join(", ")}`,
      actorId: request.depcut.userId,
      brandSpaceId: id,
    });
    return NextResponse.json({
      space: {
        avatarImageKey: updated.avatarImageKey,
        backgroundImageKey: updated.backgroundImageKey,
        bio: updated.bio,
        id: updated.id,
        linkedAccounts: updated.linkedAccounts ?? {},
        name: updated.name,
        role: membership.role,
        spaceType: updated.spaceType,
        username: updated.username,
      },
    });
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

// Owner only — deleting the space cascades its members, invites, activity,
// connections, and posts.
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getBrandSpaceMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();
  if (membership.role !== "owner") {
    return NextResponse.json(
      { error: "Forbidden", message: "Only the owner can delete this space." },
      { status: 403 },
    );
  }

  await prisma.brandSpace.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
