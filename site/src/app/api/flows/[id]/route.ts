import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import {
  deleteFlow,
  flowGenerationKeys,
  listFlowGenerations,
  ownedFlow,
  renameFlow,
  setFlowCover,
} from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";
import { delStrict } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// The Flow thread — its own row plus every generation in it, oldest first.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const generations = await listFlowGenerations(id);
  return NextResponse.json({ flow, generations });
});

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    coverGenerationId: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.coverGenerationId !== undefined, { message: "Nothing to update." });

// Rename Flow, or pin an explicit cover — the client names a generation by
// id (never a raw storage key) and the server resolves its outputKey here,
// the same boundary listFlowGenerations already keeps for read (the key
// itself never reaches the client). setFlowCover flips coverIsAuto off so a
// later generation never silently replaces the pick.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (parsed.data.name !== undefined) await renameFlow(id, parsed.data.name);
  if (parsed.data.coverGenerationId !== undefined) {
    const generation = await prisma.flowGeneration.findFirst({
      where: { id: parsed.data.coverGenerationId, flowId: id, status: "completed" },
      select: { outputKey: true },
    });
    if (!generation?.outputKey) {
      return NextResponse.json(
        { error: "Invalid request", message: "That generation has no output to use as a cover." },
        { status: 400 },
      );
    }
    await setFlowCover(id, generation.outputKey);
  }
  return NextResponse.json({ ok: true });
});

// Delete Flow — R2 objects go first, and the row (FlowGeneration rows
// cascade with it) is only removed once every object is confirmed gone.
// A failure here leaves the row in place, so the same DELETE is safely
// retryable: redeleting an already-gone key is a no-op, not an error.
export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const keys = await flowGenerationKeys(id);
  try {
    const { failed } = await delStrict(keys);
    if (failed.length > 0) {
      return NextResponse.json(
        { error: "Delete failed", message: "Some media couldn't be deleted. Try again." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Delete failed", message: "Couldn't reach storage. Try again." },
      { status: 502 },
    );
  }
  await deleteFlow(id);
  return NextResponse.json({ ok: true });
});
