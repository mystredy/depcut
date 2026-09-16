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

// Managers only. Pairs the studio with one of its own connections to
// repurpose content to it. An Active, autoPublish workflow is read by
// social-workflow-publish.ts whenever a Drop completes; postsPerDay
// ("Repurpose existing content" mode) is still just a stored preference —
// nothing schedules that drip-feed yet.
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
    autoPublish: z.boolean().default(true),
    // Only meaningful in "Repurpose existing content" mode (autoPublish
    // false) — how many of the source's existing posts to publish per day.
    postsPerDay: z.number().int().min(1).max(50).nullable().optional(),
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

  // The only supported direction today: studio → a platform. Platform →
  // platform is never valid, and platform → studio (importing existing
  // posts in) has no execution pipeline yet — see social-workflow-publish.ts.
  if (parsed.data.sourceConnectionId !== STUDIO_SOURCE_CONNECTION_ID) {
    return NextResponse.json(
      {
        error: "Unsupported workflow",
        message: "A workflow's source must be this studio — repurposing from a connected account isn't available yet.",
      },
      { status: 400 },
    );
  }

  const { name, destinationConnectionId, autoPublish, postsPerDay } = parsed.data;
  const [source, destination] = await Promise.all([
    ensureStudioSourceConnection(id),
    prisma.socialConnection.findUnique({ where: { id: destinationConnectionId } }),
  ]);
  if (!source || source.studioId !== id || !destination || destination.studioId !== id) {
    return notFoundResponse();
  }

  const workflow = await prisma.socialWorkflow.create({
    data: {
      autoPublish,
      destinationConnectionId,
      name,
      postsPerDay: autoPublish ? null : postsPerDay ?? null,
      sourceConnectionId: source.id,
    },
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
