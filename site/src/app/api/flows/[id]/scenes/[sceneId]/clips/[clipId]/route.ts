import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow, ownedScene, removeSceneClip, updateSceneClipTrim } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; sceneId: string; clipId: string }> };

const trimSchema = z
  .object({
    trimInSeconds: z.number().min(0).nullable().optional(),
    trimOutSeconds: z.number().min(0).nullable().optional(),
  })
  .strict()
  .refine((v) => v.trimInSeconds !== undefined || v.trimOutSeconds !== undefined, {
    message: "Nothing to update.",
  });

// Trim handles — clip start/end within the scene.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId, clipId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const clip = await prisma.flowSceneClip.findFirst({ where: { id: clipId, sceneId } });
  if (!clip) return notFoundResponse();

  const parsed = trimSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await updateSceneClipTrim(clipId, sceneId, {
    trimInSeconds: parsed.data.trimInSeconds !== undefined ? parsed.data.trimInSeconds : clip.trimInSeconds,
    trimOutSeconds: parsed.data.trimOutSeconds !== undefined ? parsed.data.trimOutSeconds : clip.trimOutSeconds,
  });
  return NextResponse.json({ ok: true });
});

// Remove clip — the scene only, never the generation itself.
export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId, clipId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const clip = await prisma.flowSceneClip.findFirst({ where: { id: clipId, sceneId } });
  if (!clip) return notFoundResponse();

  await removeSceneClip(clipId, sceneId);
  return NextResponse.json({ ok: true });
});
