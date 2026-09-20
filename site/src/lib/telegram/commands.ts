import { transcribeCloud } from "@/cut/server/cloud/transcribe";
import {
  detectUrlImportPlatform,
  extractFromUrl,
  UrlImportError,
  type UrlImportPlatform,
  type UrlImportResult,
} from "@/lib/marketplace/url-import";
import { prisma } from "@/lib/prisma";

type TelegramMessage = {
  message_id?: number;
  text?: string;
  chat?: { id?: number | string };
  from?: { first_name?: string; username?: string };
};

type TelegramCallbackQuery = {
  id: string;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

const URL_RE = /https?:\/\/\S+/;
const TELEGRAM_TEXT_LIMIT = 4000; // Telegram's real cap is 4096; leaves headroom for the prefix line.

function truncate(text: string, max = TELEGRAM_TEXT_LIMIT): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One call site for every Telegram Bot API method this file uses — swallows
 * failures the same way the rest of this handler does, since a webhook must
 * never throw. */
async function callTelegramApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => {});
}

const PLATFORM_LABELS: Record<UrlImportPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  snapchat: "Snapchat",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
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

  // One Telegram identity may never sit on two DepCut accounts — a chat
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

function formatDetailsMessage(result: UrlImportResult): string {
  const lines = [`${PLATFORM_LABELS[result.platform]} details`];
  if (result.handle) lines.push(result.handle);
  if (result.title) lines.push("", result.title);
  lines.push("", result.description || "(no description)");
  if (result.tags.length) lines.push("", result.tags.map((t) => `#${t}`).join(" "));
  return truncate(lines.join("\n"));
}

// A URL sent to the bot offers Details (title/description/tags/handle — see
// url-import.ts) or Transcript (real speech-to-text via the same hosted
// ElevenLabs transcriber the Speech to Text tool uses, see
// cut/server/cloud/transcribe.ts). Only the action goes in callback_data
// (Telegram's 64-byte limit rules out the URL itself); the callback handler
// below re-reads the URL from this message's own text, which it controls.
//
// The prompt itself is the "*" row on /admin/telegram-bot/commands — the
// same catch-all convention as any other trigger there, just matched
// against "has a supported link" instead of a literal word. Its `enabled`
// switch turns the whole link-import feature on or off, and its replyText
// (with {{url}}/{{platform}} substituted, same as {{first_name}} elsewhere)
// becomes the message the buttons attach to. No row yet, or "*" never
// created, falls back to a plain default so this keeps working unconfigured.
async function sendUrlOptions(botToken: string, chatId: number | string, url: string, platform: UrlImportPlatform) {
  const catchAll = await prisma.telegramCommand.findUnique({ where: { trigger: "*" } });
  if (catchAll && !catchAll.enabled) return;

  let text = catchAll
    ? catchAll.replyText.replaceAll("{{url}}", url).replaceAll("{{platform}}", PLATFORM_LABELS[platform])
    : `Got your ${PLATFORM_LABELS[platform]} link:\n${url}\n\nWhat would you like?`;
  // handleCallbackQuery recovers the url straight out of this message's own
  // text later — guarantee it survives even if a custom reply omits {{url}}.
  if (!URL_RE.test(text)) text += `\n\n${url}`;

  await callTelegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    reply_markup: {
      inline_keyboard: [
        [
          { callback_data: "d", text: "📝 Details" },
          { callback_data: "t", text: "🎙️ Transcript" },
        ],
      ],
    },
    text: truncate(text),
  });
}

// Runs the tapped action and edits the original message in place with the
// result — the buttons come off on the first edit, so a second tap on an
// already-answered message can't double-fire.
async function handleCallbackQuery(cq: TelegramCallbackQuery, botToken: string): Promise<void> {
  await callTelegramApi(botToken, "answerCallbackQuery", { callback_query_id: cq.id });

  const chatId = cq.message?.chat?.id;
  const messageId = cq.message?.message_id;
  const url = cq.message?.text?.match(URL_RE)?.[0];
  if (chatId === undefined || messageId === undefined || !url) return;

  const edit = (text: string) =>
    callTelegramApi(botToken, "editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: [] },
      text: truncate(text),
    });

  if (cq.data === "d") {
    await edit("⏳ Fetching details…");
    try {
      await edit(formatDetailsMessage(await extractFromUrl(url)));
    } catch (e) {
      await edit(`⚠️ ${e instanceof UrlImportError ? e.message : "Couldn't read that link."}`);
    }
    return;
  }

  if (cq.data === "t") {
    // Transcription is metered against real inference credits, so it can
    // only run for a chat already linked to a DepCut account (see
    // tryRedeemLinkToken) — there's no one else to bill it to.
    const user = await prisma.user.findUnique({
      select: { id: true },
      where: { telegramChatId: String(chatId) },
    });
    if (!user) {
      await edit("⚠️ Link your DepCut account first (Preferences → Link Telegram), then try again.");
      return;
    }

    await edit("⏳ Transcribing… this can take a moment.");
    try {
      const form = new FormData();
      form.append("sourceUrl", url);
      const res = await transcribeCloud.transcribe(user.id, new Request("http://internal/transcribe", { body: form, method: "POST" }));
      const body = (await res.json().catch(() => null)) as { cues?: { text: string }[]; error?: string; message?: string } | null;
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? "Transcription failed.");
      const transcript = (body?.cues ?? []).map((c) => c.text).join(" ").trim();
      await edit(transcript ? `🎙️ Transcript:\n\n${transcript}` : "No speech detected in that video.");
    } catch (e) {
      await edit(`⚠️ ${e instanceof Error ? e.message : "Couldn't transcribe that link."}`);
    }
  }
}

// The real bot behavior: an incoming message's first word (its command,
// e.g. "/start" — Telegram also allows "/start@YourBot", so the @mention
// suffix is stripped) is matched against admin-defined commands (see
// /admin/telegram-bot/commands) and replied to. A message carrying a
// YouTube/TikTok/Snapchat/Facebook/Instagram/X link instead offers Details
// or Transcript, ahead of the custom-command lookup. Silently does nothing
// if the bot is disabled, the message isn't a recognized command or link,
// or sending the reply fails — a webhook handler must never throw, or
// Telegram will keep retrying the same update.
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  try {
    const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
    if (!bot?.enabled) return;
    const botToken =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || (bot.credentials as Record<string, string> | null)?.botToken;

    if (update.callback_query) {
      if (botToken) await handleCallbackQuery(update.callback_query, botToken);
      return;
    }

    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || chatId === undefined) return;

    // Every message counts this chat as a user, recognized command or not
    // — this is the only real source for the Users count on the bot's
    // overview page.
    await prisma.telegramBotUser.upsert({
      create: { chatId: String(chatId) },
      update: {},
      where: { chatId: String(chatId) },
    });

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
            "This Telegram account is already linked to a different DepCut account — unlink it there first, then try again.",
          expired: "That code expired or wasn't recognized — generate a new one from Preferences and try again.",
          linked: "✅ Your DepCut account is now linked — real-time alerts you've opted into will DM here.",
        };
        await callTelegramApi(botToken, "sendMessage", { chat_id: chatId, text: replies[result] });
      }
      return;
    }

    const urlMatch = text.match(URL_RE);
    const platform = urlMatch ? detectUrlImportPlatform(urlMatch[0]) : null;
    if (urlMatch && platform) {
      if (botToken) await sendUrlOptions(botToken, chatId, urlMatch[0], platform);
      return;
    }

    const command = await prisma.telegramCommand.findUnique({ where: { trigger } });
    if (!command?.enabled) return;

    const replyText = command.replyText
      .replaceAll("{{first_name}}", from?.first_name ?? "")
      .replaceAll("{{username}}", from?.username ? `@${from.username}` : "");

    if (!botToken) return;
    await callTelegramApi(botToken, "sendMessage", { chat_id: chatId, text: replyText });
  } catch {
    // A webhook handler must always return 200 to Telegram — swallow
    // everything rather than let a bad update trigger retries.
  }
}
