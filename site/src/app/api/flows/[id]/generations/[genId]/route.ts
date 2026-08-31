import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { ownedFlow } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";
import { del } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; genId: string }> };

// Delete one result from the thread — its R2 object(s) go first (best-effort),
// then the row. Leaves the flow itself (and its other generations) alone;
// if this was the cover, the next completed generation becomes it on its
// own next landing (see db.ts's maybeSetAutoCover) — nothing to fix up here.
export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const generation = await prisma.flowGeneration.findFirst({ where: { id: genId, flowId: id } });
  if (!generation) return notFoundResponse();

  const keys = [generation.outputKey, generation.posterKey].filter((k): k is string => !!k);
  await del(keys);
  await prisma.flowGeneration.delete({ where: { id: genId } });
  return NextResponse.json({ ok: true });
});
