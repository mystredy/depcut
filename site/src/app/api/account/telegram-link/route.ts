import { NextResponse } from "next/server";
import { z } from "zod";

import { withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Mirrors lib/telegram/commands.ts's redemption window — a token/pin issued
// here is only valid for this long.
const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

// Current link status — Preferences reads this to show "Linked as @x" vs a
// "Link bot" button.
export const GET = withDonkeyAuth(async (request) => {
  const user = await prisma.user.findUnique({
    select: { telegramChatId: true, telegramUsername: true },
    where: { id: request.donkey.userId },
  });
  return NextResponse.json({
    linked: Boolean(user?.telegramChatId),
    telegramUsername: user?.telegramUsername ?? null,
  });
});

function randomPin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Issues a one-time token + 6-digit pin and hands back the deep link
// Preferences opens — https://t.me/<bot>?start=<token>, which Telegram turns
// into "/start <token>" for the webhook to redeem — plus the pin as a manual
// fallback for whoever the deep link doesn't cleanly open Telegram for. A
// stale, unredeemed credential from an earlier click is replaced, not
// stacked; expired rows from any user get swept opportunistically here too.
export const POST = withDonkeyAuth(async (request) => {
  const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
  const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
  const botUsername = process.env.TELEGRAM_BOT_USERNAME?.trim() || credentials.botUsername;
  if (!bot?.enabled || !botUsername) {
    return NextResponse.json(
      { error: "Unavailable", message: "The Telegram bot isn't configured yet." },
      { status: 503 },
    );
  }

  await prisma.telegramLinkToken.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - LINK_TOKEN_TTL_MS) } },
  });
  await prisma.telegramLinkToken.deleteMany({ where: { userId: request.donkey.userId } });

  let pin = randomPin();
  while (await prisma.telegramLinkToken.findUnique({ select: { token: true }, where: { pin } })) {
    pin = randomPin();
  }
  const link = await prisma.telegramLinkToken.create({ data: { pin, userId: request.donkey.userId } });

  return NextResponse.json({
    botUsername,
    deepLink: `https://t.me/${botUsername}?start=${link.token}`,
    expiresInSeconds: LINK_TOKEN_TTL_MS / 1000,
    pin: link.pin,
  });
});

const unlinkSchema = z.object({ code: z.string().trim().min(1) }).strict();

// Unlink — requires the code POST /unlink-code sent to the linked chat, so
// removing the link proves control of that chat rather than just the
// browser session. Clears the chat id/username so no more DMs go out and
// the Preferences card falls back to showing "Link bot" again.
export const DELETE = withDonkeyAuth(async (request) => {
  const parsed = unlinkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", message: "A confirmation code is required." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    select: { telegramUnlinkCode: true, telegramUnlinkCodeExpiresAt: true },
    where: { id: request.donkey.userId },
  });
  const valid =
    user?.telegramUnlinkCode === parsed.data.code &&
    user.telegramUnlinkCodeExpiresAt !== null &&
    user.telegramUnlinkCodeExpiresAt > new Date();
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid code", message: "That code is wrong or expired — send a new one and try again." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    data: {
      telegramChatId: null,
      telegramUnlinkCode: null,
      telegramUnlinkCodeExpiresAt: null,
      telegramUsername: null,
    },
    where: { id: request.donkey.userId },
  });
  return NextResponse.json({ ok: true });
});
