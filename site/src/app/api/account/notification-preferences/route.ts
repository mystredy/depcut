import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SELECT = { emailDigest: true, pushPayouts: true, telegramAlerts: true } as const;

export const GET = withDepCutAuth(async (request) => {
  const prefs = await prisma.userNotificationPreferences.upsert({
    create: { userId: request.depcut.userId },
    select: SELECT,
    update: {},
    where: { userId: request.depcut.userId },
  });
  return NextResponse.json(prefs);
});

const updateSchema = z
  .object({
    emailDigest: z.boolean().optional(),
    pushPayouts: z.boolean().optional(),
    telegramAlerts: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request) => {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prefs = await prisma.userNotificationPreferences.upsert({
    create: { userId: request.depcut.userId, ...parsed.data },
    select: SELECT,
    update: parsed.data,
    where: { userId: request.depcut.userId },
  });
  return NextResponse.json(prefs);
});
