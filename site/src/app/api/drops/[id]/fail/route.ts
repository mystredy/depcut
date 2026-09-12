import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ error: z.string().trim().min(1).max(500) });

// Told by the client when its own PUT to R2 failed — same pattern as
// submissions' fail route — so a drop doesn't sit stuck showing "uploading"
// forever after a connection drop.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const drop = await prisma.drop.findUnique({ select: { userId: true }, where: { id } });
  if (!drop) return notFoundResponse();
  if (drop.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const message = parsed.success ? parsed.data.error : "Upload failed";

  await prisma.drop.update({ data: { error: message, status: "error" }, where: { id } });
  return NextResponse.json({ ok: true });
});
