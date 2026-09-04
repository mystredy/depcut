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

function columnsFor(theme: string): { data: "logoLight" | "logoDark"; type: "logoLightContentType" | "logoDarkContentType" } | null {
  if (theme === "light") return { data: "logoLight", type: "logoLightContentType" };
  if (theme === "dark") return { data: "logoDark", type: "logoDarkContentType" };
  return null;
}

// Public: SiteLogo (site/src/cut/components/SiteLogo.tsx) reads this from
// every surface, signed in or not — a share viewer never has a session. GET
// is the only unauthenticated verb; PUT and DELETE stay super-user only.
export const GET = async (_request: Request, context: RouteContext) => {
  const { theme } = await context.params;
  const columns = columnsFor(theme);
  if (!columns) return notFoundResponse();

  const settings = await prisma.appSettings.findUnique({
    select: { [columns.data]: true, [columns.type]: true },
    where: { id: SINGLETON_ID },
  });
  const data = settings?.[columns.data];
  const contentType = settings?.[columns.type];
  if (!data || !contentType) return notFoundResponse();

  return new NextResponse(new Blob([data], { type: contentType }), {
    headers: {
      // Short-lived rather than immutable: unlike an avatar or a brand logo,
      // this URL never changes when the image does, so a stale cache would
      // otherwise outlive the upload that replaced it.
      "Cache-Control": "public, max-age=300",
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
