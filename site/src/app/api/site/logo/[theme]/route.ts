import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ theme: string }> };

const SINGLETON_ID = "singleton";
const MAX_BYTES = 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/svg+xml", "image/png", "image/webp"]);
// Rendered on every surface, signed in or not, ahead of anything else on the
// page — a slow or unreachable DB has no business making visitors wait for a
// logo. This bounds that wait so SiteLogo's own onError fallback chain reaches
// the bundled default quickly instead of hanging on the query.
const DB_TIMEOUT_MS = 3000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type LogoColumns =
  | { data: "logoLight"; type: "logoLightContentType" }
  | { data: "logoDark"; type: "logoDarkContentType" }
  | { data: "logoCompact"; type: "logoCompactContentType" };

function columnsFor(theme: string): LogoColumns | null {
  if (theme === "light") return { data: "logoLight", type: "logoLightContentType" };
  if (theme === "dark") return { data: "logoDark", type: "logoDarkContentType" };
  // The collapsed-sidebar / mobile mark: no light/dark split of its own —
  // SiteLogo falls back to the theme pair when nothing's uploaded here.
  if (theme === "compact") return { data: "logoCompact", type: "logoCompactContentType" };
  return null;
}

// Public: SiteLogo (site/src/cut/components/SiteLogo.tsx) reads this from
// every surface, signed in or not — a share viewer never has a session. GET
// is the only unauthenticated verb; PUT and DELETE stay super-user only.
export const GET = async (_request: Request, context: RouteContext) => {
  const { theme } = await context.params;
  const columns = columnsFor(theme);
  if (!columns) return notFoundResponse();

  const settings = await withTimeout(
    prisma.appSettings.findUnique({
      select: { [columns.data]: true, [columns.type]: true },
      where: { id: SINGLETON_ID },
    }),
    DB_TIMEOUT_MS,
  ).catch(() => null);
  const data = settings?.[columns.data];
  const contentType = settings?.[columns.type];
  if (!data || !contentType) return notFoundResponse();

  return new NextResponse(new Blob([data], { type: contentType }), {
    headers: {
      // A day, not immutable: this URL never changes when the logo does, so
      // any cache outlives an upload that replaces it — the tradeoff is
      // between that staleness window and every page load in between paying
      // a live DB round trip just to paint a logo. A changed logo reaching
      // every browser within a day is the better side of that trade; the
      // admin preview in BrandingSection reads the new bytes immediately
      // either way, since that upload response isn't cached at all.
      "Cache-Control": "public, max-age=86400",
      "Content-Type": contentType,
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
  const columns = columnsFor(theme);
  if (!columns) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID, [columns.data]: data, [columns.type]: contentType },
    select: { id: true },
    update: { [columns.data]: data, [columns.type]: contentType },
    where: { id: SINGLETON_ID },
  });

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
  const columns = columnsFor(theme);
  if (!columns) return notFoundResponse();

  await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID },
    select: { id: true },
    update: { [columns.data]: null, [columns.type]: null },
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ ok: true });
});
