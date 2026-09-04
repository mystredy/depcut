import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWebhookSecret } from "@/lib/telegram/webhook-secret";

export const dynamic = "force-dynamic";

// Super-user only. Registers this server's webhook URL with Telegram via
// setWebhook, so incoming messages actually start reaching
// /api/telegram/webhook. Requires a real public HTTPS origin — Telegram
// rejects localhost, so this only succeeds once deployed.
export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    (bot?.credentials as Record<string, string> | null)?.botToken;
  if (!botToken) {
    return NextResponse.json(
      { error: "not_configured", message: "Save a Bot API Token before connecting the webhook." },
      { status: 400 },
    );
  }

  const secret = await getOrCreateWebhookSecret();
  const url = `${request.nextUrl.origin}/api/telegram/webhook`;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    body: JSON.stringify({ secret_token: secret, url }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    return NextResponse.json(
      {
        error: "webhook_failed",
        message: data?.description ?? "Telegram rejected the webhook URL.",
      },
      { status: 400 },
    );
  }

  // Recorded for the "webhook connected" status shown on /admin/telegram-bot/my-bot.
  const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
  await prisma.socialAppConfig.update({
    data: { credentials: { ...credentials, webhookConnectedAt: new Date().toISOString() } },
    where: { platform: "telegram" },
  });

  return NextResponse.json({ url });
});
