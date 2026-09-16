import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { Prisma } from "@/generated/prisma/client";
import { STUDIO_SOURCE_CONNECTION_ID } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";
import { ensureStudioSourceConnection, getStudioMembership, logStudioActivity } from "@/lib/studio/access";

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
    sourceConnectionId: z.string().trim().min(1).optional(),
    destinationConnectionId: z.string().trim().min(1).optional(),
    postsPerDay: z.number().int().min(1).max(50).nullable().optional(),
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

  const { sourceConnectionId, destinationConnectionId, postsPerDay, ...rest } = parsed.data;
  const data: Prisma.SocialWorkflowUncheckedUpdateInput = { ...rest };

  if (sourceConnectionId !== undefined) {
    // Same rule as creating a workflow — see workflows/route.ts.
    if (sourceConnectionId !== STUDIO_SOURCE_CONNECTION_ID) {
      return NextResponse.json(
        {
          error: "Unsupported workflow",
          message: "A workflow's source must be this studio — repurposing from a connected account isn't available yet.",
        },
        { status: 400 },
      );
    }
    const source = await ensureStudioSourceConnection(id);
    data.sourceConnectionId = source.id;
  }
  if (destinationConnectionId !== undefined) {
    const destination = await prisma.socialConnection.findUnique({ where: { id: destinationConnectionId } });
    if (!destination || destination.studioId !== id) return notFoundResponse();
    data.destinationConnectionId = destination.id;
  }

  const effectiveSourceId = (data.sourceConnectionId as string | undefined) ?? existing.sourceConnectionId;
  const effectiveDestinationId = (data.destinationConnectionId as string | undefined) ?? existing.destinationConnectionId;
  if (effectiveSourceId === effectiveDestinationId) {
    return NextResponse.json(
      { error: "Invalid request", issues: [{ path: "destinationConnectionId", message: "Source and destination must be different connections." }] },
      { status: 400 },
    );
  }

  const effectiveAutoPublish = rest.autoPublish ?? existing.autoPublish;
  if (postsPerDay !== undefined) {
    data.postsPerDay = effectiveAutoPublish ? null : postsPerDay;
  } else if (rest.autoPublish === true) {
    data.postsPerDay = null;
  }

  const workflow = await prisma.socialWorkflow.update({
    data,
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
