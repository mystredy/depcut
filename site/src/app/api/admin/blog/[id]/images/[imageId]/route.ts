import { notFoundResponse } from "@/lib/depcut-api-auth";
import { blogContentImageKey, getObjectRange } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; imageId: string }> };

// Public: an inline body image renders for every reader of a published
// post, signed in or not — same reasoning as the cover route. Each imageId
// is written once and never overwritten (a new upload always gets a fresh
// id), so unlike the cover route's hour-long cache, this can cache forever.
export const GET = async (request: Request, context: RouteContext) => {
  const { id, imageId } = await context.params;
  const range = request.headers.get("range");
  const object = await getObjectRange(blogContentImageKey(id, imageId), range);
  if (!object) return notFoundResponse();

  return new Response(object.body, {
    status: object.status,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(object.contentLength),
      "Content-Type": object.contentType,
      "X-Content-Type-Options": "nosniff",
      // A 206 with no Content-Range is an invalid partial response — see the
      // cover route's own fix for how this breaks a real <img> load.
      ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
    },
  });
};
