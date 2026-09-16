import { NextResponse } from "next/server";
import { z } from "zod";

import {
  notFoundResponse,
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { IMPORTABLE_PLATFORMS, isConnectionUsable, STUDIO_SOURCE_CONNECTION_ID } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";
import { ensureStudioSourceConnection, getStudioMembership, logStudioActivity } from "@/lib/studio/access";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
  profileImage: true,
} as const;

// Managers only. Pairs the studio with one of its own connections, in
// either direction: studio → platform (publish) or Instagram/Facebook →
// studio (import). An Active, autoPublish, studio-sourced workflow is read
// by social-workflow-publish.ts whenever a Drop completes; any other
// Active workflow (either direction, autoPublish or postsPerDay backlog) is
// read daily by social-workflow-drip.ts / social-workflow-import.ts.
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

  // Exactly two directions are valid: studio → a platform (publish), or an
  // Instagram/Facebook connection → the studio (import — see
  // social-workflow-import.ts; the only platforms with a real "list my
  // existing posts" API, see IMPORTABLE_PLATFORMS). Platform → platform and
  // studio → studio are both rejected below by construction.
  const { name, sourceConnectionId, destinationConnectionId, autoPublish, postsPerDay } = parsed.data;
  const sourceIsStudio = sourceConnectionId === STUDIO_SOURCE_CONNECTION_ID;
  const destinationIsStudio = destinationConnectionId === STUDIO_SOURCE_CONNECTION_ID;
  if (sourceIsStudio === destinationIsStudio) {
    return NextResponse.json(
      {
        error: "Unsupported workflow",
        message: "A workflow needs exactly one side to be this studio — the other must be a connected account.",
      },
      { status: 400 },
    );
  }

  const studioConnection = await ensureStudioSourceConnection(id);
  const realConnectionId = sourceIsStudio ? destinationConnectionId : sourceConnectionId;
  const realConnection = await prisma.socialConnection.findUnique({ where: { id: realConnectionId } });
  if (!realConnection || realConnection.studioId !== id) return notFoundResponse();

  if (!sourceIsStudio && !IMPORTABLE_PLATFORMS.includes(realConnection.platform)) {
    return NextResponse.json(
      {
        error: "Unsupported workflow",
        message: `Importing existing posts from ${realConnection.platform} isn't supported.`,
      },
      { status: 400 },
    );
  }

  // "Repurpose new posts" only ever fires off this studio's own content —
  // an import direction has no per-post trigger to react to, only a daily
  // list to work through, so it belongs to "Repurpose existing content".
  if (!sourceIsStudio && autoPublish) {
    return NextResponse.json(
      {
        error: "Unsupported workflow",
        message: "Repurpose new posts only works from this studio's own content — use Repurpose existing content to import on a schedule instead.",
      },
      { status: 400 },
    );
  }
  if (sourceIsStudio && autoPublish && !isConnectionUsable({
    hasRefreshToken: Boolean(realConnection.refreshToken),
    hasToken: Boolean(realConnection.accessToken),
    status: realConnection.status,
    tokenExpiresAt: realConnection.tokenExpiresAt,
  })) {
    return NextResponse.json(
      {
        error: "Unsupported workflow",
        message: `${realConnection.accountName} needs to be connected, active, and unexpired before you can turn on Repurpose new posts.`,
      },
      { status: 400 },
    );
  }

  const source = sourceIsStudio ? studioConnection : realConnection;
  const destination = sourceIsStudio ? realConnection : studioConnection;

  // The "new posts" preset (see NewPostsPresetRow) is one toggle per
  // destination, not a thing a manager names — reuse whichever workflow
  // already covers this exact pairing instead of creating a second one, so
  // a stale client (workflows not loaded yet, or a second tab) can't
  // produce a duplicate the way SocialWorkflow's lack of a DB-level
  // constraint would otherwise allow.
  if (sourceIsStudio && autoPublish) {
    const existing = await prisma.socialWorkflow.findFirst({
      include: {
        destinationConnection: { select: connectionSelect },
        sourceConnection: { select: connectionSelect },
      },
      where: { autoPublish: true, destinationConnectionId: destination.id, sourceConnectionId: source.id },
    });
    if (existing) {
      const workflow =
        existing.status === "Active"
          ? existing
          : await prisma.socialWorkflow.update({
              data: { status: "Active" },
              include: {
                destinationConnection: { select: connectionSelect },
                sourceConnection: { select: connectionSelect },
              },
              where: { id: existing.id },
            });
      return NextResponse.json({
        workflow: { ...workflow, createdAt: workflow.createdAt.toISOString(), updatedAt: workflow.updatedAt.toISOString() },
      });
    }
  }

  const workflow = await prisma.socialWorkflow.create({
    data: {
      autoPublish,
      destinationConnectionId: destination.id,
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
