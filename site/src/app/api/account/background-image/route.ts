import { NextResponse } from "next/server";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { accountProfile } from "@/lib/account-profile";
import { del, getObject, putObject, userBackgroundImageKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// A hero photo, not an icon — a taller cap than the avatar's 256KB, still
// small enough that a direct-to-our-route upload (same shape as
// /api/account/avatar, just landing in R2 instead of a Bytes column) beats
// standing up a whole presign/complete dance for a single overwritten-in-
// place object.
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const user = await prisma.user.findUnique({
    select: { backgroundImageKey: true },
    where: { id: request.depcut.userId },
  });
  if (!user?.backgroundImageKey) return notFoundResponse();

  const object = await getObject(user.backgroundImageKey);
  if (!object) return notFoundResponse();

  return new NextResponse(new Blob([new Uint8Array(object.bytes)], { type: object.mime }), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": object.mime,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const PUT = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  const userId = request.depcut.userId;
  const key = userBackgroundImageKey(userId);
  await putObject(key, bytes, contentType);
  await prisma.user.update({ data: { backgroundImageKey: key }, where: { id: userId } });

  return NextResponse.json(await accountProfile(userId));
});

export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const userId = request.depcut.userId;
  const user = await prisma.user.findUnique({
    select: { backgroundImageKey: true },
    where: { id: userId },
  });
  if (user?.backgroundImageKey) {
    await del([user.backgroundImageKey]);
  }
  await prisma.user.update({ data: { backgroundImageKey: null }, where: { id: userId } });

  return NextResponse.json(await accountProfile(userId));
});
