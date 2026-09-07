import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { head } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Verifies the upload actually landed in R2, same pattern as submissions'
// complete route — the browser only reports "the bytes are up"; this is
// what decides whether that's true, and it's also where sizeBytes (what the
// storage quota sums over) comes from: R2's own HEAD, never the client.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const userId = request.depcut.userId;

  const post = await prisma.spacePost.findUnique({
    select: { storageKey: true, userId: true },
    where: { id },
  });
  if (!post) return notFoundResponse();
  if (post.userId !== userId) {
    return NextResponse.json({ error: "forbidden", message: "Forbidden" }, { status: 403 });
  }
  if (!post.storageKey) return notFoundResponse();

  const info = await head(post.storageKey);
  if (!info) {
    await prisma.spacePost.update({
      data: { error: "The upload never arrived.", status: "error" },
      where: { id },
    });
    return NextResponse.json(
      { error: "upload_never_arrived", message: "The upload never arrived." },
      { status: 400 }
    );
  }

  await prisma.spacePost.update({
    data: { error: null, sizeBytes: info.bytes, status: "complete" },
    where: { id },
  });

  return NextResponse.json({ ok: true });
});
