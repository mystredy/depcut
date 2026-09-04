import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { generationMediaKeys, ownedFlow } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";
import { delStrict } from "@/cut/server/cloud/r2";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; genId: string }> };

const updateSchema = z
  .object({
    // Empty string clears a custom name back to the auto prompt-derived one.
    name: z.string().trim().max(100).optional(),
    favorite: z.boolean().optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.favorite !== undefined, { message: "Nothing to update." });

// Favorite/Unfavorite, Rename Asset.
export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();

  const generation = await prisma.flowGeneration.findFirst({ where: { id: genId, flowId: id } });
  if (!generation) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await prisma.flowGeneration.update({
    where: { id: genId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name || null } : {}),
      ...(parsed.data.favorite !== undefined ? { favorite: parsed.data.favorite } : {}),
    },
  });
  return NextResponse.json({ ok: true });
});

// Delete one result from the thread — its R2 object(s) go first, and the row
// is only removed once every object is confirmed gone, so a failure here
// leaves the row in place and the same DELETE is safely retryable. Leaves
// the flow itself (and its other generations) alone; if this was the cover,
// the next completed generation becomes it on its own next landing (see
// db.ts's maybeSetAutoCover) — nothing to fix up here.
export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();

  const generation = await prisma.flowGeneration.findFirst({ where: { id: genId, flowId: id } });
  if (!generation) return notFoundResponse();

  const keys = generationMediaKeys(generation);
  try {
    const { failed } = await delStrict(keys);
    if (failed.length > 0) {
      return NextResponse.json(
        { error: "Delete failed", message: "Couldn't delete that media. Try again." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Delete failed", message: "Couldn't reach storage. Try again." },
      { status: 502 },
    );
  }
  await prisma.flowGeneration.delete({ where: { id: genId } });
  return NextResponse.json({ ok: true });
});
