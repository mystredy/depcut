import { NextResponse } from "next/server";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The signed-in user's own notification feed — newest 30, plus the unread
// count for the bell badge.
export const GET = withDonkeyAuth(async (request) => {
  const userId = request.donkey.userId;

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
