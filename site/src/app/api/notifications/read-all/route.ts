import { NextResponse } from "next/server";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const POST = withDonkeyAuth(async (request) => {
  const userId = request.donkey.userId;
  await prisma.notification.updateMany({ data: { read: true }, where: { userId } });
  return NextResponse.json({ ok: true });
});
