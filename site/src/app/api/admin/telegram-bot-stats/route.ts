import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Real counts for the bot's overview card — users is
// every distinct chat the webhook has ever recorded, commands is what's
// actually defined at /admin/telegram-bot/commands. No estimates.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const [users, commands, bot] = await Promise.all([
    prisma.telegramBotUser.count(),
    prisma.telegramCommand.count(),
    prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } }),
  ]);

  const webhookConnectedAt =
    (bot?.credentials as Record<string, string> | null)?.webhookConnectedAt ?? null;

  return NextResponse.json({ commands, users, webhookConnectedAt });
});
