import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The signed-in user's own notification feed — newest 30, plus the unread
// count for the bell badge.
export const GET = withDepCutAuth(async (request) => {
  const userId = request.depcut.userId;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      where: { userId },
    }),
    prisma.notification.count({ where: { read: false, userId } }),
  ]);

  return NextResponse.json({
    notifications: notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })),
    unreadCount,
  });
});
