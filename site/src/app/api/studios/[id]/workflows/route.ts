import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { STUDIO_SOURCE_CONNECTION_ID } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";
import { ensureStudioSourceConnection, getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

// Managers only. Pairs two of this studio's own connections to repurpose
// content between them. No real publish pipeline reads these yet —
// autoPublish is a stored preference, same as the admin-level workflows.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const workflows = await prisma.socialWorkflow.findMany({
    include: {
      destinationConnection: { select: connectionSelect },
      sourceConnection: { select: connectionSelect },
    },
    orderBy: { createdAt: "desc" },
    where: {
      destinationConnection: { studioId: id },
      sourceConnection: { studioId: id },
    },
  });

  return NextResponse.json({
    workflows: workflows.map((w) => ({
      ...w,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    })),
  });
});

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    sourceConnectionId: z.string().trim().min(1),
    destinationConnectionId: z.string().trim().min(1),
  })
  .strict()
  .refine((data) => data.sourceConnectionId !== data.destinationConnectionId, {
    message: "Source and destination must be different connections.",
    path: ["destinationConnectionId"],
  });

export const POST = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const parsed = createSchema.safeParse(await request.json());
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

  const { name, destinationConnectionId } = parsed.data;
  const [source, destination] = await Promise.all([
    parsed.data.sourceConnectionId === STUDIO_SOURCE_CONNECTION_ID
      ? ensureStudioSourceConnection(id)
      : prisma.socialConnection.findUnique({ where: { id: parsed.data.sourceConnectionId } }),
    prisma.socialConnection.findUnique({ where: { id: destinationConnectionId } }),
  ]);
  if (!source || source.studioId !== id || !destination || destination.studioId !== id) {
    return notFoundResponse();
  }

  const workflow = await prisma.socialWorkflow.create({
    data: { destinationConnectionId, name, sourceConnectionId: source.id },
    include: {
      destinationConnection: { select: connectionSelect },
      sourceConnection: { select: connectionSelect },
    },
  });

  await logStudioActivity({
    action: `Created workflow "${name}" (${source.accountName} → ${destination.accountName})`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({
    workflow: { ...workflow, createdAt: workflow.createdAt.toISOString(), updatedAt: workflow.updatedAt.toISOString() },
  });
});
