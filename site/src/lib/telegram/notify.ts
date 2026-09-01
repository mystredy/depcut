import { prisma } from "@/lib/prisma";

export type TelegramNotificationEvent =
  | "submission"
  | "withdrawal"
  | "supportTicket"
  | "signup"
  | "systemError";

const EVENT_FLAG: Partial<
  Record<
    TelegramNotificationEvent,
    | "notifySubmissions"
    | "notifyWithdrawals"
    | "notifySupportTickets"
    | "notifySignups"
    | "notifySystemErrors"
  >
> = {
  signup: "notifySignups",
  submission: "notifySubmissions",
  supportTicket: "notifySupportTickets",
  systemError: "notifySystemErrors",
  withdrawal: "notifyWithdrawals",
};

// Shared gate for both send paths below: which destinations get this event,
// and the bot token to send with. Each destination's id and the bot token
// come from this server's .env first — that's what admin saves mirror into
// and what's actually live — falling back to the DB row only if the env var
// isn't set. Returns null if the bot's Enable toggle is off, no destination
// is set, this event type is off, or no token is configured.
async function resolveTelegramTargets(
  event: TelegramNotificationEvent
): Promise<{ botToken: string; destinations: string[] } | null> {
  const flag = EVENT_FLAG[event];
  const [settings, bot] = await Promise.all([
    flag ? prisma.telegramNotificationSettings.findUnique({ where: { id: "singleton" } }) : null,
    prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } }),
  ]);
  if (!bot?.enabled) return null;
  if (flag && !settings?.[flag]) return null;

  const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
  const destinations = [
    process.env.TELEGRAM_ADMIN_ID?.trim() || credentials.adminId,
    process.env.TELEGRAM_GROUP_ID?.trim() || credentials.groupId,
    process.env.TELEGRAM_CHANNEL_ID?.trim() || credentials.channelId,
  ].filter((id): id is string => Boolean(id));
  if (destinations.length === 0) return null;

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim() || credentials.botToken;
  if (!botToken) return null;

  return { botToken, destinations };
}

// fetch only rejects on a network-level failure — a chat that blocked the
// bot, a bad chat id, or a rate limit all come back as an ordinary resolved
// response with a non-2xx status, which every send site below used to just
// discard. Telegram's error body's `description` is the actual reason
// ("Forbidden: bot was blocked by the user"), so it's worth a log line.
async function logIfRejected(event: TelegramNotificationEvent, chatId: string, res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  console.error(`[telegram] ${event} -> ${chatId} rejected (${res.status}):`, body?.description ?? body);
}

// Best-effort admin alert, fanned out to every destination configured at
// /admin/telegram-bot/settings — the admin, group, and channel, all set on
// the bot's own credentials (SocialAppConfig) — all of them, not a choice
// of one. No-ops silently per resolveTelegramTargets. Callers fire this
// alongside their real work and never let a notification problem fail it.
export async function notifyTelegram(event: TelegramNotificationEvent, text: string): Promise<void> {
  try {
    const targets = await resolveTelegramTargets(event);
    if (!targets) return;

    await Promise.all(
      targets.destinations.map((chatId) =>
        fetch(`https://api.telegram.org/bot${targets.botToken}/sendMessage`, {
          body: JSON.stringify({ chat_id: chatId, text }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }).then((res) => logIfRejected(event, chatId, res))
      )
    );
  } catch (error) {
    // Best-effort — never let a notification failure break the real action.
    // Logged so a missed alert has a trace somewhere (a dropped DB connection
    // reading settings is the remaining unlogged case — Telegram itself
    // rejecting the send is now caught by logIfRejected above, not here).
    console.error(`[telegram] notify(${event}) failed:`, error);
  }
}

export type TelegramMedia = { data: Uint8Array<ArrayBuffer>; contentType: string };

// Same routing as notifyTelegram, but attaches photos directly — sendPhoto
// for one, sendMediaGroup for several — instead of a plain text message.
// Telegram can't fetch a preview from an admin-authed route, so the bytes
// ride the request itself. Falls back to notifyTelegram when there's no
// media to attach.
export async function notifyTelegramWithMedia(
  event: TelegramNotificationEvent,
  text: string,
  media: TelegramMedia[]
): Promise<void> {
  if (media.length === 0) return notifyTelegram(event, text);
  try {
    const targets = await resolveTelegramTargets(event);
    if (!targets) return;
    // Photo/media-group captions cap at 1024 chars, well under sendMessage's
    // 4096 — a long ticket message still needs to fit somewhere.
    const caption = text.length > 1024 ? `${text.slice(0, 1021)}…` : text;

    await Promise.all(
      targets.destinations.map((chatId) =>
        (media.length === 1
          ? sendPhoto(targets.botToken, chatId, media[0], caption)
          : sendMediaGroup(targets.botToken, chatId, media, caption)
        ).then((res) => logIfRejected(event, chatId, res))
      )
    );
  } catch (error) {
    // Best-effort — never let a notification failure break the real action.
    // Logged for the same reason as notifyTelegram's catch above.
    console.error(`[telegram] notifyWithMedia(${event}) failed:`, error);
  }
}

function sendPhoto(botToken: string, chatId: string, photo: TelegramMedia, caption: string) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", new Blob([photo.data], { type: photo.contentType }), "attachment");
  return fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { body: form, method: "POST" });
}

function sendMediaGroup(botToken: string, chatId: string, media: TelegramMedia[], caption: string) {
  const form = new FormData();
  form.append("chat_id", chatId);
  const items = media.map((m, i) => {
    const key = `file${i}`;
    form.append(key, new Blob([m.data], { type: m.contentType }), key);
    // Telegram only renders a caption from the group's first item.
    return { media: `attach://${key}`, type: "photo", ...(i === 0 ? { caption } : {}) };
  });
  form.append("media", JSON.stringify(items));
  return fetch(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, { body: form, method: "POST" });
}
