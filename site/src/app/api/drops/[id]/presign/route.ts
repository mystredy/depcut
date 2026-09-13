import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { presignPut, dropVideoKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    fileName: z.string().trim().min(1).max(200),
    mime: z.string().trim().min(1).max(120),
  })
  .strict();

// Mints a presigned PUT for a drop's video.
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
