import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SELECT = { emailDigest: true, pushPayouts: true, telegramAlerts: true } as const;

export const GET = withDonkeyAuth(async (request) => {
  const prefs = await prisma.userNotificationPreferences.upsert({
    create: { userId: request.donkey.userId },
    select: SELECT,
    update: {},
    where: { userId: request.donkey.userId },
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

export const PATCH = withDonkeyAuth(async (request) => {
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const prefs = await prisma.userNotificationPreferences.upsert({
    create: { userId: request.donkey.userId, ...parsed.data },
    select: SELECT,
    update: parsed.data,
    where: { userId: request.donkey.userId },
  });
  return NextResponse.json(prefs);
});
