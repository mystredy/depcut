import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { deleteScene, ownedFlow, ownedScene, renameScene } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

const updateSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await renameScene(sceneId, parsed.data.name);
  return NextResponse.json({ ok: true });
});

export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  // The scene row + its clips go; the R2 export (if any) is left as a
  // best-effort orphan, same tradeoff del() makes elsewhere — nothing else
  // ever points at it once the scene is gone.
  await deleteScene(sceneId);
  return NextResponse.json({ ok: true });
});
