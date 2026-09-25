import { notFoundResponse } from "@/lib/depcut-api-auth";
import { blogContentVideoKey, getObjectRange } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; videoId: string }> };

// Public: renders for every reader of a published post, signed in or not.
// Range support matters far more here than for an image — a <video> element
// range-requests by default so it can seek without downloading the whole
// file. Same immutable-forever caching as the content-image route: each
// videoId is written once and never overwritten.
export const GET = async (request: Request, context: RouteContext) => {
  const { id, videoId } = await context.params;
  const range = request.headers.get("range");
  const object = await getObjectRange(blogContentVideoKey(id, videoId), range);
  if (!object) return notFoundResponse();

  return new Response(object.body, {
    status: object.status,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(object.contentLength),
      "Content-Type": object.contentType,
      "X-Content-Type-Options": "nosniff",
      ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
    },
  });
};
