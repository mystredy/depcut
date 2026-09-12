import { prisma } from "@/lib/prisma";

// The deletion code needs to reach the owner without leaking through a
// notification preview — a push banner or a locked-screen glance shows
// whatever text comes first, so the code can't lead the message the way a
// plain notifyUserEverywhere call would put it. This sends the bell
// notification (safe — it only shows once signed in) and, separately, a
// Telegram DM with the code wrapped in Telegram's own spoiler markup and
// pushed past the part of the message a preview actually renders.
export async function notifyStudioDeleteCode(params: {
  userId: string;
  studioName: string;
  code: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      body: `Code: ${params.code} — expires in 10 minutes.`,
      title: `Confirm deleting "${params.studioName}"`,
      userId: params.userId,
    },
  });

  const user = await prisma.user.findUnique({
    select: { notificationPreferences: { select: { telegramAlerts: true } }, telegramChatId: true },
    where: { id: params.userId },
  });
  if (!user?.telegramChatId || !user.notificationPreferences?.telegramAlerts) return;

  try {
    const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
    if (!bot?.enabled) return;
    const botToken =
      process.env.TELEGRAM_BOT_TOKEN?.trim() || (bot.credentials as Record<string, string> | null)?.botToken;
    if (!botToken) return;

    const text = [
      `⚠️ Someone asked to delete "${escapeHtml(params.studioName)}" on DepCut.`,
      "",
      `Code: <tg-spoiler>${params.code}</tg-spoiler>`,
      "",
      "Expires in 10 minutes. Wasn't you? Sign out of any devices you don't recognize.",
    ].join("\n");

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      body: JSON.stringify({ chat_id: user.telegramChatId, parse_mode: "HTML", text }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Best-effort — the bell notification above already landed.
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
