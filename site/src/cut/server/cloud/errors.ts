// Client-caught errors the user shouldn't have to read verbatim (a raw
// fetch/library message naming an internal URL or status code) land here
// instead — routed to the admin's Telegram, not the user's screen.
import { notifyTelegram } from "@/lib/telegram/notify";
import { err } from "./util";

const MAX_LEN = 2000;

export const errorsCloud = {
  async report(userId: string, req: Request): Promise<Response> {
    let context = "";
    let message = "";
    try {
      const body = (await req.json()) as { context?: string; message?: string };
      context = typeof body.context === "string" ? body.context.slice(0, 200) : "";
      message = typeof body.message === "string" ? body.message.slice(0, MAX_LEN) : "";
    } catch {
      return err("Send JSON with context and message.", 400);
    }
    if (!context || !message) return err("context and message are required.", 400);

    await notifyTelegram(
      "systemError",
      `⚠️ ${context}\nuser: ${userId}\n${message}`
    );
    return Response.json({ ok: true });
  },
};
