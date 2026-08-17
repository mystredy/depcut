import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. Which admin events push a message to the Telegram bot's
// destinations — the admin, group, and channel, all set on the bot's own
// credentials at /admin/telegram-bot/settings (SocialAppConfig, platform
// "telegram") — see /api/admin/social-apps. This route only owns the
// per-event on/off flags.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const settings = await prisma.telegramNotificationSettings.upsert({
    create: { id: SINGLETON_ID },
    update: {},
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});

const updateSchema = z
  .object({
    notifySubmissions: z.boolean().optional(),
    notifyWithdrawals: z.boolean().optional(),
    notifySupportTickets: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
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

  const settings = await prisma.telegramNotificationSettings.upsert({
    create: { id: SINGLETON_ID, ...parsed.data },
    update: parsed.data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
