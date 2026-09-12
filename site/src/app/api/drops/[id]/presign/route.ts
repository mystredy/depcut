import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { presignPut, dropVideoKey } from "@/cut/server/cloud/r2";
import { SPACE_STORAGE_LIMIT_BYTES, spaceStorageUsedBytes } from "@/lib/studio/storage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    mime: z.string().trim().min(1).max(120),
    // The picked file's own size — known client-side before any bytes move,
    // unlike a submission's presign (which never needed a quota gate). This
    // is what the 10GB check below runs against; the number that actually
    // lands on the row afterward comes from R2's own HEAD on complete, never
    // trusted from here.
    size: z.number().int().positive(),
  })
  .strict();

// Mints a presigned PUT for a drop's video, gated on the account's 10GB
// quota — checked here, before a byte moves, rather than after upload
// (submissions' presign has no such gate; a drop's does, since nothing
// else caps how much a studio can hold).
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const userId = request.depcut.userId;

  const drop = await prisma.drop.findUnique({ select: { userId: true }, where: { id } });
  if (!drop) return notFoundResponse();
  if (drop.userId !== userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid request." },
      { status: 400 }
    );
  }

  const used = await spaceStorageUsedBytes(userId);
  if (used + parsed.data.size > SPACE_STORAGE_LIMIT_BYTES) {
    return NextResponse.json(
      { error: "storage_full", message: "This would go over your 10GB Space storage limit." },
      { status: 409 }
    );
  }

  const key = dropVideoKey(userId, id, parsed.data.fileName);
  const url = await presignPut(key, parsed.data.mime);

  await prisma.drop.update({
    data: {
      error: null,
      fileName: parsed.data.fileName,
      status: "uploading",
      storageKey: key,
    },
    where: { id },
  });

  return NextResponse.json({ key, url });
});
