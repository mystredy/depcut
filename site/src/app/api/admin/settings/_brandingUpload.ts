import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

type BrandingField = "favicon" | "appleTouchIcon" | "socialShareImage";

const TYPE_COLUMN: Record<BrandingField, "faviconContentType" | "appleTouchIconContentType" | "socialShareImageContentType"> = {
  appleTouchIcon: "appleTouchIconContentType",
  favicon: "faviconContentType",
  socialShareImage: "socialShareImageContentType",
};

/** PUT/DELETE for one admin-uploaded branding image that isn't a per-theme
 * logo (those live in /api/site/logo/[theme] instead) — the favicon, the
 * apple touch icon, the social share image. Each is its own column pair on
 * the singleton AppSettings row; this factory is the one place that knows
 * how to write to any of them, so favicon/route.ts, apple-touch-icon/route.ts,
 * and social-share-image/route.ts are each a few lines naming their own
 * field, type allowlist, and size cap. */
export function brandingUploadRoute(options: {
  field: BrandingField;
  allowedTypes: Set<string>;
  maxBytes: number;
  typeErrorMessage: string;
}) {
  const { field, allowedTypes, maxBytes, typeErrorMessage } = options;
  const typeField = TYPE_COLUMN[field];

  const PUT = withDepCutAuth(async (request) => {
    if (!(await isDepCutSuperUser(request.depcut.userId))) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only super users can do this." },
        { status: 403 },
      );
    }

    const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
    if (!allowedTypes.has(contentType)) {
      return NextResponse.json({ error: typeErrorMessage }, { status: 415 });
    }

    const data = new Uint8Array(await request.arrayBuffer());
    if (data.byteLength === 0 || data.byteLength > maxBytes) {
      return NextResponse.json({ error: "Image too large." }, { status: 413 });
    }

    await prisma.appSettings.upsert({
      create: { id: SINGLETON_ID, [field]: data, [typeField]: contentType },
      select: { id: true },
      update: { [field]: data, [typeField]: contentType },
      where: { id: SINGLETON_ID },
    });

    return NextResponse.json({ ok: true });
  });

  const DELETE = withDepCutAuth(async (request) => {
    if (!(await isDepCutSuperUser(request.depcut.userId))) {
      return NextResponse.json(
        { error: "Forbidden", message: "Only super users can do this." },
        { status: 403 },
      );
    }

    await prisma.appSettings.upsert({
      create: { id: SINGLETON_ID },
      select: { id: true },
      update: { [field]: null, [typeField]: null },
      where: { id: SINGLETON_ID },
    });

    return NextResponse.json({ ok: true });
  });

  return { DELETE, PUT };
}
