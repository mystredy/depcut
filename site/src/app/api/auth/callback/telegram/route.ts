import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { verifyTelegramLoginAuth } from "@/lib/telegram/login";

export const dynamic = "force-dynamic";

// A literal route wins over better-auth's [...all] catch-all at the same
// path, so this coexists safely under /api/auth without touching it.
//
// Telegram Login has no authorize/token exchange — the widget redirects
// here with a signed payload (id, first_name, username, auth_date, hash,
// ...), verified with the bot's own token as the signing key (see
// verifyTelegramLoginAuth). better-auth has no built-in provider for this
// shape and no supported way to mint a session from an arbitrary verified
// identity, so this route stops at verification: it confirms the payload
// is genuinely from Telegram and returns who it belongs to, but does not
// yet create a User or session. Wire that up when a real "Log in with
// Telegram" button exists to call this.
export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);

  const botToken =
    process.env.TELEGRAM_BOT_TOKEN?.trim() ||
    (
      (await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } }))
        ?.credentials as Record<string, string> | null
    )?.botToken;

  if (!botToken) {
    return page({
      message: "The Telegram bot isn't configured on this server yet.",
      success: false,
      title: "Not configured",
    });
  }

  if (!verifyTelegramLoginAuth(params, botToken)) {
    return page({
      message: "This login link is invalid or expired — try logging in again.",
      success: false,
      title: "Verification failed",
    });
  }

  return page({
    message: `Verified as Telegram user "${params.username ?? params.id}". No session is created yet — this endpoint isn't linked to a login button.`,
    success: true,
    title: "Verified",
  });
}

function page(opts: { title: string; message: string; success: boolean }) {
  const color = opts.success ? "#059669" : "#dc2626";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${opts.title}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5;">
  <div style="text-align:center;max-width:360px;padding:24px;">
    <p style="color:${color};font-weight:600;font-size:15px;margin:0 0 8px;">${opts.title}</p>
    <p style="font-size:13px;color:#a3a3a3;margin:0;">${opts.message}</p>
  </div>
</body></html>`,
    { headers: { "Content-Type": "text/html" }, status: opts.success ? 200 : 400 },
  );
}
