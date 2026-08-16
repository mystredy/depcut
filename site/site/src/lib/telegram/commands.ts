import { prisma } from "@/lib/prisma";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { first_name?: string; username?: string };
  };
};

// The real bot behavior: an incoming message's first word (its command,
// e.g. "/start" — Telegram also allows "/start@YourBot", so the @mention
// suffix is stripped) is matched against admin-defined commands (see
// /admin/telegram-bot/commands) and replied to. Silently does nothing if
// the bot is disabled, the message isn't a recognized command, or sending
// the reply fails — a webhook handler must never throw, or Telegram will
// keep retrying the same update.
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  try {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || chatId === undefined) return;

    const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
    if (!bot?.enabled) return;

    // Every message counts this chat as a user, recognized command or not
    // — this is the only real source for the Users count on the bot's
    // overview page.
    await prisma.telegramBotUser.upsert({
      create: { chatId: String(chatId) },
      update: {},
      where: { chatId: String(chatId) },
    });

    const trigger = text.split(/\s+/)[0].split("@")[0];
    const command = await prisma.telegramCommand.findUnique({ where: { trigger } });
    if (!command?.enabled) return;

    const from = update.message?.from;
    const replyText = command.replyText
      .replaceAll("{{first_name}}", from?.first_name ?? "")
      .replaceAll("{{username}}", from?.username ? `@${from.username}` : "");

    const botToken =
      process.env.TELEGRAM_BOT_TOKEN?.trim() ||
      (bot.credentials as Record<string, string> | null)?.botToken;
    if (!botToken) return;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      body: JSON.stringify({ chat_id: chatId, text: replyText }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // A webhook handler must always return 200 to Telegram — swallow
    // everything rather than let a bad update trigger retries.
  }
}
