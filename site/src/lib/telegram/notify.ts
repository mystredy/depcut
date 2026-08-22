import { prisma } from "@/lib/prisma";

export type TelegramNotificationEvent = "submission" | "withdrawal" | "supportTicket" | "systemError";

const EVENT_FLAG: Partial<
  Record<TelegramNotificationEvent, "notifySubmissions" | "notifyWithdrawals" | "notifySupportTickets">
> = {
  submission: "notifySubmissions",
  withdrawal: "notifyWithdrawals",
  supportTicket: "notifySupportTickets",
  // "systemError" has no settings row of its own (would need a schema change/
  // migration this codebase's rules keep out of an agent's hands) — it rides
  // the bot's plain Enable toggle instead of a per-category one.
};

// Best-effort admin alert, fanned out to every destination configured at
// /admin/telegram-bot/settings — the admin, group, and channel, all set on
// the bot's own credentials (SocialAppConfig) — all of them, not a choice
// of one. Each destination's id and the bot token come from this server's
// .env first — that's what admin saves mirror into and what's actually
// live — falling back to the DB row only if the env var isn't set. No-ops
// silently if the bot's Enable toggle is off, no destination is set, or
// this event type is off — callers fire this alongside their real work and
// never let a notification problem fail it.
export async function notifyTelegram(event: TelegramNotificationEvent, text: string): Promise<void> {
  try {
    const flag = EVENT_FLAG[event];
    const [settings, bot] = await Promise.all([
      flag ? prisma.telegramNotificationSettings.findUnique({ where: { id: "singleton" } }) : null,
      prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } }),
    ]);
    if (!bot?.enabled) return;
    if (flag && !settings?.[flag]) return;

    const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
    const destinations = [
      process.env.TELEGRAM_ADMIN_ID?.trim() || credentials.adminId,
      process.env.TELEGRAM_GROUP_ID?.trim() || credentials.groupId,
      process.env.TELEGRAM_CHANNEL_ID?.trim() || credentials.channelId,
    ].filter((id): id is string => Boolean(id));
    if (destinations.length === 0) return;

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || credentials.botToken;
    if (!botToken) return;

    await Promise.all(
      destinations.map((chatId) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          body: JSON.stringify({ chat_id: chatId, text }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        })
      )
    );
  } catch {
    // Best-effort — never let a notification failure break the real action.
  }
}
