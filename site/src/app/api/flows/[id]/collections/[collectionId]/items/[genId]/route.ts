import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { ownedCollection, ownedFlow, removeFromCollection } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; collectionId: string; genId: string }> };

// Remove from Collection — the generation itself is untouched.
export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, collectionId, genId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();
  const collection = await ownedCollection(id, collectionId);
  if (!collection) return notFoundResponse();

  await removeFromCollection(collectionId, genId);
  return NextResponse.json({ ok: true });
});
