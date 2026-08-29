import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { notifyTelegram } from "@/lib/telegram/notify";

export const dynamic = "force-dynamic";

const MAX_LEN = 2000;

// Public — a crash can happen before sign-in (the landing page, /sign-in
// itself), so this can't require a session. Mirrors cut/server/cloud/
// errors.ts's errorsCloud.report for the editor: a raw internal error (a
// fetch/library message naming an internal URL or status code) isn't
// something a user should have to read, so a caller reports it here instead
// — routed to the admin's Telegram (see reportSiteError, the client side of
// this) rather than the user's screen.
export async function POST(request: Request) {
  let context = "";
  let message = "";
  try {
    const body = (await request.json()) as { context?: string; message?: string };
    context = typeof body.context === "string" ? body.context.slice(0, 200) : "";
    message = typeof body.message === "string" ? body.message.slice(0, MAX_LEN) : "";
  } catch {
    return NextResponse.json({ error: "Send JSON with context and message." }, { status: 400 });
  }
  if (!context || !message) {
    return NextResponse.json({ error: "context and message are required." }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  const who = session?.user.email ?? "signed out";

  await notifyTelegram("systemError", `🚨 ${context}\nuser: ${who}\n${message}`);
  return NextResponse.json({ ok: true });
}
