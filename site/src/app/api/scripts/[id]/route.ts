import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { deleteScriptGeneration } from "@/lib/scripts/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const deleted = await deleteScriptGeneration(request.depcut.userId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
});
