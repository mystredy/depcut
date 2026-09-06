import { notFoundResponse } from "@/lib/depcut-api-auth";
import { getObjectRange } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ path: string[] }> };

// Public, unauthenticated: the built-in stock video/music library ships with
// every hosted Cut project the same way the old public/cut-stock-video files
// did — this route replaces those files with a proxy to R2, so the bytes
// live in cloud storage instead of the git checkout and Vercel build output.
// R2 objects here are content-addressed by their filename and never change,
// so the cache is immutable rather than the short-lived one the site logo
// route uses. Range is forwarded so a video's preview/timeline can seek
// exactly like it could reading a static file.
export const GET = async (request: Request, context: RouteContext) => {
  const { path } = await context.params;
  if (path.length === 0 || path.some((p) => p === "" || p === "." || p === "..")) {
    return notFoundResponse();
  }

  const key = `stock-assets/${path.join("/")}`;
  const range = request.headers.get("range");
  const object = await getObjectRange(key, range);
  if (!object) return notFoundResponse();

  return new Response(object.body, {
    status: object.status,
    headers: {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(object.contentLength),
      ...(object.contentRange ? { "Content-Range": object.contentRange } : {}),
      "Content-Type": object.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
};
