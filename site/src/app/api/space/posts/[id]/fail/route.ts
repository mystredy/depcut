import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({ error: z.string().trim().min(1).max(500) });

// Told by the client when its own PUT to R2 failed — same pattern as
// submissions' fail route — so a post doesn't sit stuck showing "uploading"
// forever after a connection drop.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const post = await prisma.spacePost.findUnique({ select: { userId: true }, where: { id } });
  if (!post) return notFoundResponse();
  if (post.userId !== request.depcut.userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  const message = parsed.success ? parsed.data.error : "Upload failed";

  await prisma.spacePost.update({ data: { error: message, status: "error" }, where: { id } });
  return NextResponse.json({ ok: true });
});
