import { NextResponse } from "next/server";

import { notFoundResponse, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const userId = request.depcut.userId;

  const existing = await prisma.notification.findUnique({ select: { userId: true }, where: { id } });
  if (!existing || existing.userId !== userId) {
    return notFoundResponse();
  }

  const notification = await prisma.notification.update({ data: { read: true }, where: { id } });
  return NextResponse.json({ notification: { ...notification, createdAt: notification.createdAt.toISOString() } });
});
