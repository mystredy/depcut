import { NextResponse } from "next/server";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const UNLINK_CODE_TTL_MS = 10 * 60 * 1000;

// Sends a 6-digit code to the linked Telegram chat — required before DELETE
// on the parent route will actually unlink. The code never rides this
// response; it only reaches whoever controls that chat, so unlinking proves
// the request came from them, not just from whoever's signed into the
// browser right now.
export const POST = withDepCutAuth(async (request) => {
  const user = await prisma.user.findUnique({
    select: { telegramChatId: true },
    where: { id: request.depcut.userId },
  });
  if (!user?.telegramChatId) {
    return NextResponse.json({ error: "Not linked", message: "No Telegram account is linked." }, { status: 400 });
  }

  const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
  const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || credentials.botToken;
  if (!bot?.enabled || !botToken) {
    return NextResponse.json(
      { error: "Unavailable", message: "The Telegram bot isn't configured yet." },
      { status: 503 },
    );
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await prisma.user.update({
    data: { telegramUnlinkCode: code, telegramUnlinkCodeExpiresAt: new Date(Date.now() + UNLINK_CODE_TTL_MS) },
    where: { id: request.depcut.userId },
  });

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    body: JSON.stringify({
      chat_id: user.telegramChatId,
      // tg-spoiler blurs the code until tapped — keeps it off a lock screen
      // or over-the-shoulder glance at the chat, same as the code itself
      // being the thing that proves you control this chat.
      parse_mode: "HTML",
      text: `Your DepCut unlink code: <tg-spoiler>${code}</tg-spoiler>\n\nEnter this in Preferences to confirm unlinking this Telegram account. Expires in 10 minutes.`,
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });

  return NextResponse.json({ sent: true });
});
