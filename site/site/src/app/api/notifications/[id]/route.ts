import { NextResponse } from "next/server";

import { notFoundResponse, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  const { id } = await context.params;
  const userId = request.donkey.userId;

  const existing = await prisma.notification.findUnique({ select: { userId: true }, where: { id } });
  if (!existing || existing.userId !== userId) {
    return notFoundResponse();
  }

  const notification = await prisma.notification.update({ data: { read: true }, where: { id } });
  return NextResponse.json({ notification: { ...notification, createdAt: notification.createdAt.toISOString() } });
});
