import { prisma } from "@/lib/prisma";

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number | string };
    from?: { first_name?: string; username?: string };
  };
};

// Two ways into the same row from Preferences' "Link bot" flow: the deep
// link opens https://t.me/<bot>?start=<token>, which Telegram turns into
// the message "/start <token>" here; the 6-digit pin is the fallback for
// when that link doesn't open Telegram cleanly (no app installed, wrong
// device) — the user just DMs the bot with it directly. Either redeems the
// same row, once, within 15 minutes of issue.
const LINK_TOKEN_TTL_MS = 15 * 60 * 1000;

type RedeemResult = "linked" | "expired" | "already-taken";

async function tryRedeemLinkToken(
  where: { token: string } | { pin: string },
  chatId: number | string,
  username: string | undefined
): Promise<RedeemResult> {
  const link = await prisma.telegramLinkToken.findUnique({ where });
  if (!link) return "expired";

  await prisma.telegramLinkToken.delete({ where: { token: link.token } }).catch(() => {});
  if (Date.now() - link.createdAt.getTime() > LINK_TOKEN_TTL_MS) return "expired";

  // One Telegram identity may never sit on two Depcut accounts — a chat
  // already linked elsewhere is rejected outright, not silently
  // reassigned, so the original account never loses its link without
  // deciding to.
  const existingOwner = await prisma.user.findUnique({
    select: { id: true },
    where: { telegramChatId: String(chatId) },
  });
  if (existingOwner && existingOwner.id !== link.userId) return "already-taken";

  await prisma.user.update({
    data: { telegramChatId: String(chatId), telegramUsername: username ?? null },
    where: { id: link.userId },
  });
  return "linked";
}

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

    const botToken =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || (bot.credentials as Record<string, string> | null)?.botToken;

    const [rawTrigger, payload] = text.split(/\s+/);
    const trigger = rawTrigger.split("@")[0];
    const from = update.message?.from;
    const isBarePin = /^\d{6}$/.test(text);

    if ((trigger === "/start" && payload) || isBarePin) {
      const result = await tryRedeemLinkToken(
        isBarePin ? { pin: text } : { token: payload },
        chatId,
        from?.username
      );
      if (botToken) {
        const replies: Record<RedeemResult, string> = {
          "already-taken":
            "This Telegram account is already linked to a different Depcut account — unlink it there first, then try again.",
          expired: "That code expired or wasn't recognized — generate a new one from Preferences and try again.",
          linked: "✅ Your Depcut account is now linked — real-time alerts you've opted into will DM here.",
        };
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          body: JSON.stringify({ chat_id: chatId, text: replies[result] }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
      }
      return;
    }

    const command = await prisma.telegramCommand.findUnique({ where: { trigger } });
    if (!command?.enabled) return;

    const replyText = command.replyText
      .replaceAll("{{first_name}}", from?.first_name ?? "")
      .replaceAll("{{username}}", from?.username ? `@${from.username}` : "");

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
