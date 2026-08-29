import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// Builds a Notification create() input for use inside a $transaction
// alongside the write that triggered it, so the notification never fires
// for a mutation that ends up rolling back.
export function notifyUser(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}): Prisma.NotificationCreateArgs {
  return { data: input };
}

// Same shape as notifyUser, but also DMs the user's linked Telegram chat
// when they've turned on telegramAlerts in Preferences — the real-time
// channel that promise describes. Best-effort and standalone (not
// transaction-composable like notifyUser): the bell notification always
// lands even if the Telegram send fails or nothing's linked.
export async function notifyUserEverywhere(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  const [, user] = await Promise.all([
    prisma.notification.create({ data: input }),
    prisma.user.findUnique({
      select: {
        notificationPreferences: { select: { telegramAlerts: true } },
        telegramChatId: true,
      },
      where: { id: input.userId },
    }),
  ]);
  if (!user?.telegramChatId || !user.notificationPreferences?.telegramAlerts) return;

  try {
    const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
    if (!bot?.enabled) return;
    const botToken =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || (bot.credentials as Record<string, string> | null)?.botToken;
    if (!botToken) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: input.body ? `${input.title}\n\n${input.body}` : input.title,
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Best-effort — the bell notification above already landed.
  }
}
