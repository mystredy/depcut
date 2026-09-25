import { NextResponse } from "next/server";

import { isDepCutSuperUser, notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { blogContentVideoKey, putObject } from "@/cut/server/cloud/r2";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

// A short generated/uploaded clip, not a full production video — this is an
// inline body embed, not the post's primary media.
const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm"]);

type JsonBody = { url?: unknown; dataBase64?: unknown; contentType?: unknown };

// Super-user only: the blog editor's Insert Video popover's Upload/Generate/
// Library tabs all funnel through this one route — same reasoning and same
// shape as api/admin/blog/[id]/images (see that file's own comment). URL
// (a YouTube link) never calls this at all; it has nothing to store.
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
  let videoContentType: string;
  if (contentType === "application/json") {
    const body = (await request.json().catch(() => null)) as JsonBody | null;
    const url = typeof body?.url === "string" ? body.url : "";
    const dataBase64 = typeof body?.dataBase64 === "string" ? body.dataBase64 : "";

    if (url) {
      // A media-library pick — its presigned R2 link is only good for an
      // hour, so re-host it here the same way a picked image is.
      let fetched: Response;
      try {
        fetched = await fetch(url);
      } catch {
        return NextResponse.json({ error: "Could not fetch that URL." }, { status: 400 });
      }
      if (!fetched.ok) {
        return NextResponse.json({ error: `Fetching that URL failed (${fetched.status}).` }, { status: 400 });
      }
      videoContentType = fetched.headers.get("content-type")?.split(";")[0].trim() ?? "";
      if (!ALLOWED_TYPES.has(videoContentType)) {
        return NextResponse.json({ error: "That URL isn't an MP4 or WebM video." }, { status: 415 });
      }
      data = Buffer.from(await fetched.arrayBuffer());
    } else if (dataBase64) {
      // An AI-generated result — bytes already in hand from
      // /api/inference/assets.
      videoContentType = typeof body?.contentType === "string" ? body.contentType : "";
      if (!ALLOWED_TYPES.has(videoContentType)) {
        return NextResponse.json({ error: "Unsupported video type." }, { status: 415 });
      }
      data = Buffer.from(dataBase64, "base64");
    } else {
      return NextResponse.json({ error: "url or dataBase64 is required." }, { status: 400 });
    }
  } else {
    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported video type." }, { status: 415 });
    }
    videoContentType = contentType;
    data = Buffer.from(await request.arrayBuffer());
  }

  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Video too large (50MB max)." }, { status: 413 });
  }

  const videoId = crypto.randomUUID();
  await putObject(blogContentVideoKey(id, videoId), data, videoContentType);

  return NextResponse.json({
    id: videoId,
    url: `${DEPCUT_CANONICAL}/api/admin/blog/${id}/videos/${videoId}`,
  });
});
