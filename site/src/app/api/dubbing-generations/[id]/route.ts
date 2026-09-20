import { NextResponse } from "next/server";

import { deleteDubbingGeneration } from "@/lib/dubbingGenerations/db";
import { withDepCutAuth } from "@/lib/depcut-api-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const result = await deleteDubbingGeneration(request.depcut.userId, id);
  if (result === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (result === "storage_error") {
    return NextResponse.json(
      { error: "Delete failed", message: "Couldn't delete that media. Try again." },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
});
