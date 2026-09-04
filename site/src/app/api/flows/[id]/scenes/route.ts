import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { createScene, listScenes, ownedFlow } from "@/lib/flows/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// Every Scene Builder sequence in this Flow, most recently updated first.
export const GET = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();
  const scenes = await listScenes(id);
  return NextResponse.json({ scenes });
});

const createSchema = z.object({ name: z.string().trim().min(1).max(100).optional() }).strict();

export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const scene = await createScene(id, request.depcut.userId, parsed.data.name?.trim() || "Untitled scene");
  return NextResponse.json({ scene }, { status: 201 });
});
