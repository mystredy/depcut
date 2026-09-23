import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { presignGet, putObject, studioAvatarKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// The client crops to a square and re-encodes before uploading, so anything
// arriving here is already small. The cap is a backstop against a caller
// that skips that path, not a size the UI ever approaches.
const MAX_BYTES = 256 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

// Redirects to a short-lived signed R2 GET URL — same pattern as the drop
// video route. Any signed-in account can view it, matching the rest of a
// studio's public profile.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const studio = await prisma.studio.findUnique({ select: { avatarImageKey: true }, where: { id } });
  if (!studio?.avatarImageKey) return notFoundResponse();

  const url = await presignGet(studio.avatarImageKey);
  return NextResponse.redirect(url);
});

// Managers only. The key is fixed per studio (see studioAvatarKey) and
// overwritten in place, so a re-upload never needs to clean up the old one.
export const PUT = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  const key = studioAvatarKey(id);
  await putObject(key, data, contentType);
  const updated = await prisma.studio.update({ data: { avatarImageKey: key }, where: { id } });
  await logStudioActivity({ action: "Updated the avatar", actorId: request.depcut.userId, studioId: id });

  return NextResponse.json({
    studio: {
      avatarImageKey: updated.avatarImageKey,
      backgroundImageKey: updated.backgroundImageKey,
      bio: updated.bio,
      id: updated.id,
      name: updated.name,
      role: membership.role,
      showFollowerCount: updated.showFollowerCount,
      spaceType: updated.spaceType,
      updatedAt: updated.updatedAt,
      username: updated.username,
    },
  });
});

export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const updated = await prisma.studio.update({ data: { avatarImageKey: null }, where: { id } });
  await logStudioActivity({ action: "Removed the avatar", actorId: request.depcut.userId, studioId: id });

  return NextResponse.json({
    studio: {
      avatarImageKey: updated.avatarImageKey,
      backgroundImageKey: updated.backgroundImageKey,
      bio: updated.bio,
      id: updated.id,
      name: updated.name,
      role: membership.role,
      showFollowerCount: updated.showFollowerCount,
      spaceType: updated.spaceType,
      updatedAt: updated.updatedAt,
      username: updated.username,
    },
  });
});
