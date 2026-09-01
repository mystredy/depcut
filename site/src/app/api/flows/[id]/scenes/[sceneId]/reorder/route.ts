import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow, ownedScene, reorderSceneClips } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

const reorderSchema = z.object({ clipIds: z.array(z.string().min(1)).min(1) }).strict();

// Drag-to-reorder — the whole new sequence at once.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const parsed = reorderSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  // Every id named must actually be one of this scene's own clips — an id
  // from another scene (even one the same caller owns) must not be
  // reachable through this endpoint.
  const existing = await prisma.flowSceneClip.findMany({ where: { sceneId }, select: { id: true } });
  const existingIds = new Set(existing.map((c) => c.id));
  const given = parsed.data.clipIds;
  if (given.length !== existingIds.size || !given.every((id) => existingIds.has(id))) {
    return NextResponse.json(
      { error: "Invalid request", message: "That order doesn't match this scene's clips." },
      { status: 400 },
    );
  }
  await reorderSceneClips(sceneId, given);
  return NextResponse.json({ ok: true });
});
