import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every broadcast announcement.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({ announcements });
});

const createSchema = z
  .object({
    headline: z.string().trim().min(1).max(2000),
    priority: z.enum(["Info", "Warning", "Critical"]),
    isPinned: z.boolean(),
    targetType: z.enum(["all", "super_users", "specific_user"]),
    targetUserIds: z.array(z.string().trim().min(1)).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .strict()
  .refine((v) => v.targetType !== "specific_user" || (v.targetUserIds && v.targetUserIds.length > 0), {
    message: "At least one targetUserIds entry is required when targetType is specific_user",
  });

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

  const { scheduledAt, targetType, targetUserIds, ...rest } = parsed.data;
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const status = scheduledDate && scheduledDate > new Date() ? "Scheduled" : "Active";

  const announcement = await prisma.announcement.create({
    data: {
      ...rest,
      scheduledAt: scheduledDate,
      status,
      targetType,
      targetUserIds: targetType === "specific_user" ? (targetUserIds ?? []) : [],
    },
  });

  // An instant (non-scheduled) broadcast delivers now, into every matching
  // user's real notification bell — the only surface that actually reads
  // announcements today. A future-dated one stays stored only; nothing
  // sweeps scheduled announcements to deliver them when their time comes.
  if (status === "Active") {
    const recipients = await prisma.user.findMany({
      select: { id: true },
      where:
        targetType === "specific_user"
          ? { id: { in: targetUserIds ?? [] } }
          : targetType === "super_users"
            ? { superUser: true }
            : {},
    });
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((u) => ({ body: announcement.headline, title: "Announcement", userId: u.id })),
      });
    }
  }

  return NextResponse.json({ announcement });
});
