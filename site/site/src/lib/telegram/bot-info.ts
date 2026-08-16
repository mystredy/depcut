export type TelegramBotInfo = { id: string; username: string };

// Calls Telegram's getMe to resolve a bot token's real identity — the admin
// enters only the token; its numeric ID and @username are derived, never
// typed in. Returns null on any failure (bad token, network error), which
// the caller treats as "couldn't verify" without blocking the token save.
export async function fetchTelegramBotInfo(token: string): Promise<TelegramBotInfo | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok || typeof data.result?.id !== "number") return null;
    return { id: String(data.result.id), username: data.result.username ?? "" };
  } catch {
    return null;
  }
}
