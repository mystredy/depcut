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

const updateSchema = z
  .object({
    headline: z.string().trim().min(1).max(2000).optional(),
    priority: z.enum(["Info", "Warning", "Critical"]).optional(),
    isPinned: z.boolean().optional(),
    targetType: z.enum(["all", "super_users", "specific_user"]).optional(),
    targetUserIds: z.array(z.string().trim().min(1)).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
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
  const existing = await prisma.announcement.findUnique({ select: { id: true }, where: { id } });
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

  const { scheduledAt, targetType, targetUserIds, ...rest } = parsed.data;
  const scheduledDate = scheduledAt === undefined ? undefined : scheduledAt ? new Date(scheduledAt) : null;

  const announcement = await prisma.announcement.update({
    data: {
      ...rest,
      scheduledAt: scheduledDate,
      status: scheduledDate === undefined ? undefined : scheduledDate && scheduledDate > new Date() ? "Scheduled" : "Active",
      targetType,
      targetUserIds: targetType === undefined ? undefined : targetType === "specific_user" ? (targetUserIds ?? []) : [],
    },
    where: { id },
  });

  return NextResponse.json({ announcement });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.announcement.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  await prisma.announcement.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
