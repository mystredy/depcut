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
      // A 206 with no Content-Range is an invalid partial response — Safari
      // (the one browser that actually range-requests a plain <img>, for a
      // large JPEG like a cover photo) rejects it outright and shows the
      // broken-image icon instead of the picture. object.status is only
      // ever 206 when getObjectRange already computed this.
      ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
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

  // The blog AI agent sets a cover by URL rather than a file picker, so this
  // verb also takes {url} as JSON — fetched here rather than client-side to
  // dodge CORS, then validated exactly like a direct upload.
  let data: Buffer;
  let imageContentType: string;
  if (contentType === "application/json") {
    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === "string" ? body.url : "";
    if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });

    let fetched: Response;
    try {
      fetched = await fetch(url);
    } catch {
      return NextResponse.json({ error: "Could not fetch that URL." }, { status: 400 });
    }
    if (!fetched.ok) {
      return NextResponse.json({ error: `Fetching that URL failed (${fetched.status}).` }, { status: 400 });
    }

    imageContentType = fetched.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!ALLOWED_TYPES.has(imageContentType)) {
      return NextResponse.json({ error: "That URL isn't a PNG, WebP, or JPEG image." }, { status: 415 });
    }
    data = Buffer.from(await fetched.arrayBuffer());
  } else {
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
    }
    imageContentType = contentType;
    data = Buffer.from(await request.arrayBuffer());
  }

  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await putObject(blogCoverKey(id), data, imageContentType);
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
