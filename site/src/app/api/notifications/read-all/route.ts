import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const POST = withDepCutAuth(async (request) => {
  const userId = request.depcut.userId;
  await prisma.notification.updateMany({ data: { read: true }, where: { userId } });
  return NextResponse.json({ ok: true });
});
