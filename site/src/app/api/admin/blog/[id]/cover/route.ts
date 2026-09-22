import { NextResponse } from "next/server";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { del, getObjectRange, putObject, blogCoverKey } from "@/cut/server/cloud/r2";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/webp", "image/jpeg"]);

// Public: the blog index and post pages (cut/blog) read this from every
// visitor, signed in or not. GET is the only unauthenticated verb; PUT and
// DELETE stay super-user only, gated through the admin editor.
export const GET = async (request: Request, context: RouteContext) => {
  const { id } = await context.params;
  const range = request.headers.get("range");
  const object = await getObjectRange(blogCoverKey(id), range);
  if (!object) return notFoundResponse();

  return new Response(object.body, {
    status: object.status,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(object.contentLength),
      "Content-Type": object.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
};

export const PUT = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.blogPost.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await putObject(blogCoverKey(id), data, contentType);
  await prisma.blogPost.update({ data: { hasCoverImage: true }, where: { id } });

  return NextResponse.json({ ok: true });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.blogPost.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return notFoundResponse();

  await del([blogCoverKey(id)]);
  await prisma.blogPost.update({ data: { hasCoverImage: false }, where: { id } });

  return NextResponse.json({ ok: true });
});
