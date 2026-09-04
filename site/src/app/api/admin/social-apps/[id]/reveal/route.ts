import { NextResponse } from "next/server";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Super-user only. Returns one credential field's real value, on explicit
// request only — the list route (GET /api/admin/social-apps) never includes
// secret values, so this is the only path a secret can leave the server on,
// and only when an admin deliberately clicks "reveal" for that one field.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const field = new URL(request.url).searchParams.get("field")?.trim();
  if (!field) {
    return NextResponse.json(
      { error: "Invalid request", message: "A field query param is required." },
      { status: 400 },
    );
  }

  const row = await prisma.socialAppConfig.findUnique({ where: { id } });
  if (!row) {
    return notFoundResponse();
  }

  const credentials = (row.credentials as Record<string, string> | null) ?? {};
  return NextResponse.json({ value: credentials[field] ?? null });
});
