import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { del, getObjectRange, putObject, siteLogoKey } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ theme: string }> };

const MAX_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/svg+xml", "image/png", "image/webp"]);
const THEMES = new Set(["light", "dark", "compact"]);

// Public: SiteLogo (site/src/cut/components/SiteLogo.tsx) reads this from
// every surface, signed in or not — a share viewer never has a session. GET
// is the only unauthenticated verb; PUT and DELETE stay super-user only.
//
// Bytes live in R2 (see PUT below), not the database — this used to be a
// Postgres bytea column read on every request, which meant painting a logo
// depended on a live DB round trip and, when that connection was slow or
// down, either hung or fell back to the bundled default and looked like the
// upload had been lost. R2 is a plain object fetch with no such dependency.
export const GET = async (request: Request, context: RouteContext) => {
  const { theme } = await context.params;
  if (!THEMES.has(theme)) return notFoundResponse();

  const range = request.headers.get("range");
  const object = await getObjectRange(siteLogoKey(theme), range);
  if (!object) return notFoundResponse();

  return new Response(object.body, {
    status: object.status,
    headers: {
      "Accept-Ranges": "bytes",
      // An hour, not immutable: this key is overwritten in place on every
      // upload rather than content-addressed, so a replaced logo needs the
      // old cache to actually expire rather than never.
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

  const { theme } = await context.params;
  if (!THEMES.has(theme)) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await putObject(siteLogoKey(theme), data, contentType);

  return NextResponse.json({ ok: true });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { theme } = await context.params;
  if (!THEMES.has(theme)) return notFoundResponse();

  await del([siteLogoKey(theme)]);

  return NextResponse.json({ ok: true });
});
