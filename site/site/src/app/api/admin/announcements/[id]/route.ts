import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    headline: z.string().trim().min(1).max(2000).optional(),
    priority: z.enum(["Info", "Warning", "Critical"]).optional(),
    isPinned: z.boolean().optional(),
    targetType: z.enum(["all", "super_users", "specific_user"]).optional(),
    targetUserId: z.string().trim().min(1).nullable().optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  const { scheduledAt, targetType, targetUserId, ...rest } = parsed.data;
  const scheduledDate = scheduledAt === undefined ? undefined : scheduledAt ? new Date(scheduledAt) : null;

  const announcement = await prisma.announcement.update({
    data: {
      ...rest,
      scheduledAt: scheduledDate,
      status: scheduledDate === undefined ? undefined : scheduledDate && scheduledDate > new Date() ? "Scheduled" : "Active",
      targetType,
      targetUserId: targetType === undefined ? undefined : targetType === "specific_user" ? targetUserId : null,
    },
    include: { targetUser: { select: { displayName: true, email: true, name: true } } },
    where: { id },
  });

  return NextResponse.json({ announcement });
});

export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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
