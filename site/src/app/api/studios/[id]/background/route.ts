import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { presignGet, putObject, studioBackgroundKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

// The client crops to the banner's aspect ratio and re-encodes before
// uploading. A wider frame than the avatar's, so the cap is more generous —
// still well above anything the crop dialog's own output actually produces.
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

type RouteContext = { params: Promise<{ id: string }> };

// Redirects to a short-lived signed R2 GET URL — same pattern as the avatar
// route above and the drop video route.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const studio = await prisma.studio.findUnique({ select: { backgroundImageKey: true }, where: { id } });
  if (!studio?.backgroundImageKey) return notFoundResponse();

  const url = await presignGet(studio.backgroundImageKey);
  return NextResponse.redirect(url);
});

// Managers only. The key is fixed per studio (see studioBackgroundKey) and
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

  const key = studioBackgroundKey(id);
  await putObject(key, data, contentType);
  const updated = await prisma.studio.update({ data: { backgroundImageKey: key }, where: { id } });
  await logStudioActivity({ action: "Updated the background image", actorId: request.depcut.userId, studioId: id });

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

  const updated = await prisma.studio.update({ data: { backgroundImageKey: null }, where: { id } });
  await logStudioActivity({ action: "Removed the background image", actorId: request.depcut.userId, studioId: id });

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
