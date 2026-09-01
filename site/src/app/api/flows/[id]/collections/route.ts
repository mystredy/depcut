import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { createCollection, listCollections, ownedFlow } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Every collection in this Flow, most recently updated first.
export const GET = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();
  const collections = await listCollections(id);
  return NextResponse.json({ collections });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(100) }).strict();

export const POST = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.donkey.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const collection = await createCollection(id, request.donkey.userId, parsed.data.name);
  return NextResponse.json({ collection }, { status: 201 });
});
