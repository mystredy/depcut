import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const MAX_BYTES = 512 * 1024;
const ALLOWED_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

// A brand's uploaded logo, stored as bytes the same way UserAvatar is —
// see /api/account/avatar for the identical pattern.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const brand = await prisma.brand.findUnique({
    select: { logo: true, logoContentType: true },
    where: { id },
  });
  if (!brand?.logo || !brand.logoContentType) return notFoundResponse();

  return new NextResponse(new Blob([brand.logo], { type: brand.logoContentType }), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": brand.logoContentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const PUT = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.brand.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return notFoundResponse();

  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (!ALLOWED_TYPES.has(contentType)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  const data = new Uint8Array(await request.arrayBuffer());
  if (data.byteLength === 0 || data.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Image too large." }, { status: 413 });
  }

  const brand = await prisma.brand.update({
    data: { logo: data, logoContentType: contentType },
    where: { id },
  });

  return NextResponse.json({ updatedAt: brand.updatedAt.toISOString() });
});
