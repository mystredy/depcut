import { NextResponse } from "next/server";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { blogContentImageKey, putObject } from "@/cut/server/cloud/r2";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Inline body images can reasonably run larger than the 2MB cover — a
// screenshot or a generated illustration isn't always tiny.
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/webp", "image/jpeg", "image/gif"]);

type JsonBody = { url?: unknown; dataBase64?: unknown; contentType?: unknown };

// Super-user only: the blog editor's Insert Image popover funnels every
// source (a pasted URL, an uploaded file, an AI-generated result, a pick
// from the admin media library) through this one route, so every inline
// image ends up durably hosted at our own URL rather than pointing at
// someone else's server (a pasted URL) or an hour-lived presigned link (a
// library pick) or nothing at all (base64 bytes with nowhere to live).
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
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

  let data: Buffer;
  let imageContentType: string;
  if (contentType === "application/json") {
    const body = (await request.json().catch(() => null)) as JsonBody | null;
    const url = typeof body?.url === "string" ? body.url : "";
    const dataBase64 = typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

    if (url) {
      // Covers both a pasted URL and a media-library pick (whose presigned
      // R2 link is only good for an hour) — fetched here rather than
      // client-side to dodge CORS, then validated exactly like a direct
      // upload, same as the cover route's own {url} path.
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
        return NextResponse.json({ error: "That URL isn't a PNG, WebP, JPEG, or GIF image." }, { status: 415 });
      }
      data = Buffer.from(await fetched.arrayBuffer());
    } else if (dataBase64) {
      // An AI-generated result — the bytes are already in hand from
      // /api/inference/assets, so this just needs to land them somewhere
      // durable instead of round-tripping back through a URL fetch.
      imageContentType = typeof body?.contentType === "string" ? body.contentType : "";
      if (!ALLOWED_TYPES.has(imageContentType)) {
        return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
      }
      data = Buffer.from(dataBase64, "base64");
    } else {
      return NextResponse.json({ error: "url or dataBase64 is required." }, { status: 400 });
    }
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

  const imageId = crypto.randomUUID();
  await putObject(blogContentImageKey(id, imageId), data, imageContentType);

  return NextResponse.json({
    id: imageId,
    url: `${DEPCUT_CANONICAL}/api/admin/blog/${id}/images/${imageId}`,
  });
});
