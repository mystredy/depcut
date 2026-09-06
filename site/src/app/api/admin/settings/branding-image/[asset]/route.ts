import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import {
  appleTouchIconKey,
  del,
  faviconKey,
  putObject,
  socialShareImageKey,
} from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ asset: string }> };

// One dynamic route for the admin-only branding images that aren't a
// per-theme logo (those live in /api/site/logo/[theme], which is public —
// this one never is: there's no public GET here, only the /icon,
// /apple-icon, and /opengraph-image conventions read these bytes back).
// Consolidated from three near-identical route files (favicon,
// apple-touch-icon, social-share-image) into one to stay under Vercel's
// Hobby-plan serverless function ceiling — see
// docs/guides/vercel-function-budget.md.
//
// Bytes live in R2 (see the site logo route's own migration for why — a
// live DB read on every /icon and /opengraph-image request had the same
// hang-or-silently-fall-back-to-default risk as the logo route did).
const ASSET_CONFIG = {
  "apple-touch-icon": {
    allowedTypes: new Set(["image/png"]),
    key: appleTouchIconKey,
    maxBytes: 512 * 1024,
    typeErrorMessage: "The apple touch icon must be a PNG image.",
  },
  favicon: {
    allowedTypes: new Set(["image/png"]),
    key: faviconKey,
    maxBytes: 256 * 1024,
    typeErrorMessage: "Favicons must be a PNG image.",
  },
  "social-share-image": {
    allowedTypes: new Set(["image/png", "image/jpeg"]),
    key: socialShareImageKey,
    maxBytes: 2 * 1024 * 1024,
    typeErrorMessage: "The social share image must be a PNG or JPEG image.",
  },
} as const;

type AssetKey = keyof typeof ASSET_CONFIG;

function configFor(asset: string) {
  return Object.prototype.hasOwnProperty.call(ASSET_CONFIG, asset)
    ? ASSET_CONFIG[asset as AssetKey]
    : null;
}

export const PUT = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { asset } = await context.params;
  const config = configFor(asset);
  if (!config) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!config.allowedTypes.has(contentType)) {
    return NextResponse.json({ error: config.typeErrorMessage }, { status: 415 });
  }

  const data = Buffer.from(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > config.maxBytes) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await putObject(config.key(), data, contentType);

  return NextResponse.json({ ok: true });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { asset } = await context.params;
  const config = configFor(asset);
  if (!config) return notFoundResponse();

  await del([config.key()]);

  return NextResponse.json({ ok: true });
});
