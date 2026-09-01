import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { addSceneClip, ownedFlow, ownedScene } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

const addSchema = z.object({ generationId: z.string().min(1) }).strict();

// Add to Scene — appended at the end of the sequence. The clip is allowed
// to still be rendering (a Continue Scene submission adds itself the
// moment it's created, before the render lands) so the Scene Builder can
// show it as a processing slot rather than making the user come back.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const parsed = addSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const generation = await prisma.flowGeneration.findFirst({
    where: { id: parsed.data.generationId, flowId: id, kind: "video" },
    select: { id: true },
  });
  if (!generation) {
    return NextResponse.json(
      { error: "Invalid request", message: "That's not a video in this Flow." },
      { status: 400 },
    );
  }
  await addSceneClip(sceneId, generation.id);
  return NextResponse.json({ ok: true }, { status: 201 });
});
