import { NextResponse } from "next/server";

import { handleTelegramUpdate } from "@/lib/telegram/commands";
import { getOrCreateWebhookSecret } from "@/lib/telegram/webhook-secret";

export const dynamic = "force-dynamic";

// Public — Telegram calls this directly, no admin session involved. Auth
// is the X-Telegram-Bot-Api-Secret-Token header Telegram echoes back on
// every request once registered via setWebhook (see
// /api/admin/telegram-webhook/connect), checked against the same secret.
// Always returns 200 quickly, even on a bad or unrecognized update —
// returning an error status makes Telegram retry the same update
// repeatedly.
export async function POST(request: Request) {
  const secret = await getOrCreateWebhookSecret();
  const header = request.headers.get("x-telegram-bot-api-secret-token");
  if (header !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const update = await request.json().catch(() => null);
  if (update) {
    await handleTelegramUpdate(update);
  }

  return NextResponse.json({ ok: true });
}
