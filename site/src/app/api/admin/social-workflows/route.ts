import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

// Super-user only. Pairs a source connection with a destination connection.
// No real publish pipeline reads these yet.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const workflows = await prisma.socialWorkflow.findMany({
    include: {
      destinationConnection: { select: connectionSelect },
      sourceConnection: { select: connectionSelect },
    },
    orderBy: { createdAt: "desc" },
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
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

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

  const workflow = await prisma.socialWorkflow.create({
    data: parsed.data,
    include: {
      destinationConnection: { select: connectionSelect },
      sourceConnection: { select: connectionSelect },
    },
  });

  return NextResponse.json({
    workflow: { ...workflow, createdAt: workflow.createdAt.toISOString(), updatedAt: workflow.updatedAt.toISOString() },
  });
});
