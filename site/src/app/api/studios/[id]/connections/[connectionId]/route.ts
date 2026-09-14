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

type RouteContext = { params: Promise<{ id: string; connectionId: string }> };

const updateSchema = z.object({ accountName: z.string().trim().min(1).max(160) }).strict();

// Managers only. Renames a Repurpose connection's display name — nothing
// else about the connection changes.
export const PATCH = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, connectionId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.studioId !== id) return notFoundResponse();

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 400 },
    );
  }

  const updated = await prisma.socialConnection.update({
    data: { accountName: parsed.data.accountName },
    where: { id: connectionId },
  });

  if (updated.accountName !== connection.accountName) {
    await logStudioActivity({
      action: `Renamed ${connection.accountName} to ${updated.accountName} (${connection.platform})`,
      actorId: request.depcut.userId,
      studioId: id,
    });
  }

  const { accessToken, refreshToken, ...c } = updated;
  return NextResponse.json({
    connection: {
      ...c,
      createdAt: c.createdAt.toISOString(),
      hasRefreshToken: Boolean(refreshToken),
      hasToken: Boolean(accessToken),
      tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
      updatedAt: c.updatedAt.toISOString(),
    },
  });
});

// Managers only. Disconnects a Repurpose destination.
export const DELETE = withDepCutAuth(async (request: DepCutAuthenticatedRequest, context: RouteContext) => {
  const { id, connectionId } = await context.params;
  const membership = await getStudioMembership(request.depcut.userId, id);
  if (!membership) return notFoundResponse();

  const connection = await prisma.socialConnection.findUnique({ where: { id: connectionId } });
  if (!connection || connection.studioId !== id) return notFoundResponse();

  await prisma.socialConnection.delete({ where: { id: connectionId } });
  await logStudioActivity({
    action: `Disconnected ${connection.accountName} (${connection.platform})`,
    actorId: request.depcut.userId,
    studioId: id,
  });

  return NextResponse.json({ ok: true });
});
