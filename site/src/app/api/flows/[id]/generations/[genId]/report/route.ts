import { NextResponse } from "next/server";
import { z } from "zod";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { ownedFlow } from "@/lib/flows/db";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; genId: string }> };

const reportSchema = z
  .object({
    reason: z.enum(["inaccurate", "inappropriate", "copyright", "harmful", "other"]),
    details: z.string().trim().max(2000).optional(),
  })
  .strict();

// Report Output — stored server-side only, associated with the reporting
// user, Flow, generation, reason and timestamp. Never read back by any
// generation/flow endpoint, so a report is never visible to any user,
// including the one who filed it; a moderation queue reads FlowGenerationReport
// directly.
export const POST = withDepCutAuth(async (request, context: RouteContext) => {
  const { id, genId } = await context.params;
  const flow = await ownedFlow(request.depcut.userId, id);
  if (!flow) return notFoundResponse();

  const generation = await prisma.flowGeneration.findFirst({ where: { id: genId, flowId: id }, select: { id: true } });
  if (!generation) return notFoundResponse();

  const parsed = reportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  await prisma.flowGenerationReport.create({
    data: {
      generationId: genId,
      flowId: id,
      userId: request.depcut.userId,
      reason: parsed.data.reason,
      ...(parsed.data.details ? { details: parsed.data.details } : {}),
    },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});
