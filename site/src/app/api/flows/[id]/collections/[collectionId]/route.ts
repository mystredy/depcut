import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { deleteCollection, ownedCollection, ownedFlow } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; collectionId: string }> };

// Delete a collection — a grouping only, never the generations in it.
export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, collectionId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();
  const collection = await ownedCollection(id, collectionId);
  if (!collection) return notFoundResponse();

  await deleteCollection(collectionId);
  return NextResponse.json({ ok: true });
});
