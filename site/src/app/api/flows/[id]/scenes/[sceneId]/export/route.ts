import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { flowMediaUrl } from "@/lib/flows/media";
import { ownedFlow, ownedScene, setSceneExport } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";
import { concatVideoClips } from "@/cut/server/frames";
import { flowMediaKey, getObject, putObject } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

// Concatenation of several clips is real ffmpeg work but each source clip is
// short (an AI-generated take, seconds to tens of seconds), so this runs
// synchronously in-request rather than through a separate job queue — the
// same tradeoff /api/inference/assets makes for music generation, which
// also polls its render to completion in-request.
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string; sceneId: string }> };

// Export — concatenate the scene's current clip order/trims into one MP4,
// stored under this Flow's own R2 prefix. Re-running overwrites the
// previous export; the scene's exportKey is cleared by any clip/trim/order
// change (see db.ts's invalidateExport) so a stale render is never served.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, sceneId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const scene = await ownedScene(id, sceneId);
  if (!scene) return notFoundResponse();

  const clips = await prisma.flowSceneClip.findMany({
    where: { sceneId },
    orderBy: { position: "asc" },
    include: { generation: { select: { status: true, outputKey: true } } },
  });
  if (clips.length === 0) {
    return NextResponse.json({ error: "Invalid request", message: "This scene has no clips yet." }, { status: 400 });
  }
  const notReady = clips.find((c) => c.generation.status !== "completed" || !c.generation.outputKey);
  if (notReady) {
    return NextResponse.json(
      { error: "Invalid request", message: "Every clip needs to finish rendering before exporting." },
      { status: 400 },
    );
  }

  try {
    const sources = await Promise.all(
      clips.map(async (c) => {
        const object = await getObject(c.generation.outputKey!);
        if (!object) throw new Error("A clip's media is missing from storage.");
        return { bytes: object.bytes, trimInSeconds: c.trimInSeconds, trimOutSeconds: c.trimOutSeconds };
      }),
    );
    const merged = await concatVideoClips(sources);
    const key = flowMediaKey(request.donkey.userId, id, `scene-${sceneId}-${Date.now()}.mp4`);
    await putObject(key, merged, "video/mp4");
    await setSceneExport(sceneId, key);
    return NextResponse.json({ exportUrl: await flowMediaUrl(key) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    return NextResponse.json({ error: "Export failed", message }, { status: 502 });
  }
});
