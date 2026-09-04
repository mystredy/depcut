import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
    autoPublish: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.socialWorkflow.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

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
    where: { id },
  });

  return NextResponse.json({
    workflow: { ...workflow, createdAt: workflow.createdAt.toISOString(), updatedAt: workflow.updatedAt.toISOString() },
  });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.socialWorkflow.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  await prisma.socialWorkflow.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
