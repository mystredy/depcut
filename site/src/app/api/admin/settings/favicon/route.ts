import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";
const MAX_BYTES = 256 * 1024;
// PNG only: the /icon route (site/src/app/icon.tsx) reads these bytes back
// with this same content type, and a browser tab icon has no reason to be
// anything larger than a small square PNG. There's no public GET here — the
// /icon convention is the public surface; this route only writes.
const ALLOWED_TYPE = "image/png";

export const PUT = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (contentType !== ALLOWED_TYPE) {
    return NextResponse.json({ error: "Favicons must be a PNG image." }, { status: 415 });
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  await prisma.appSettings.upsert({
    create: { favicon: data, faviconContentType: contentType, id: SINGLETON_ID },
    select: { id: true },
    update: { favicon: data, faviconContentType: contentType },
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ ok: true });
});

export const DELETE = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  await prisma.appSettings.upsert({
    create: { id: SINGLETON_ID },
    select: { id: true },
    update: { favicon: null, faviconContentType: null },
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ ok: true });
});
