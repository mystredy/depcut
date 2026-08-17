import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { setEnvVar } from "@/lib/env-file";

// Telegram signs every webhook POST with this token in the
// X-Telegram-Bot-Api-Secret-Token header — without checking it, anyone who
// discovers the webhook URL could feed the bot fake updates. Read from
// .env first, same as every other Telegram credential; generated once and
// persisted (DB + mirrored to .env) if neither has one yet.
export async function getOrCreateWebhookSecret(): Promise<string> {
  const envSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (envSecret) return envSecret;

  const bot = await prisma.socialAppConfig.findUnique({ where: { platform: "telegram" } });
  const credentials = (bot?.credentials as Record<string, string> | null) ?? {};
  if (credentials.webhookSecret) return credentials.webhookSecret;

  const secret = randomBytes(24).toString("hex");
  await prisma.socialAppConfig.upsert({
    create: { credentials: { webhookSecret: secret }, platform: "telegram" },
    update: { credentials: { ...credentials, webhookSecret: secret } },
    where: { platform: "telegram" },
  });
  await setEnvVar("TELEGRAM_WEBHOOK_SECRET", secret).catch(() => {});
  return secret;
}
