import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { addToCollection, ownedCollection, ownedFlow } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; collectionId: string }> };

const addSchema = z.object({ generationId: z.string().min(1) }).strict();

// Add to Collection.
export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id, collectionId } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const collection = await ownedCollection(id, collectionId);
  if (!collection) return notFoundResponse();

  const parsed = addSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const generation = await prisma.flowGeneration.findFirst({
    where: { id: parsed.data.generationId, flowId: id },
    select: { id: true },
  });
  if (!generation) {
    return NextResponse.json({ error: "Invalid request", message: "That asset isn't in this Flow." }, { status: 400 });
  }
  await addToCollection(collectionId, generation.id);
  return NextResponse.json({ ok: true }, { status: 201 });
});
