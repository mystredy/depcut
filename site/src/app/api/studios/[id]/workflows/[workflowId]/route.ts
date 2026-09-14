import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; workflowId: string }> };

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

async function loadOwnedWorkflow(studioId: string, workflowId: string) {
  const workflow = await prisma.socialWorkflow.findUnique({
    include: { destinationConnection: true, sourceConnection: true },
    where: { id: workflowId },
  });
  if (!workflow || workflow.sourceConnection.studioId !== studioId || workflow.destinationConnection.studioId !== studioId) {
    return null;
  }
  return workflow;
}

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
    autoPublish: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, workflowId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const existing = await loadOwnedWorkflow(id, workflowId);
  if (!existing) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const workflow = await prisma.socialWorkflow.update({
    data: parsed.data,
    include: {
      destinationConnection: { select: connectionSelect },
      sourceConnection: { select: connectionSelect },
    },
    where: { id: workflowId },
  });

  return NextResponse.json({
    workflow: { ...workflow, createdAt: workflow.createdAt.toISOString(), updatedAt: workflow.updatedAt.toISOString() },
  });
});

export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, workflowId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const existing = await loadOwnedWorkflow(id, workflowId);
  if (!existing) return notFoundResponse();

  await prisma.socialWorkflow.delete({ where: { id: workflowId } });

  await logStudioActivity({
    action: `Deleted workflow "${existing.name}"`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({ ok: true });
});
