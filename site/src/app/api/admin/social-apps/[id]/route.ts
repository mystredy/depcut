import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { SOCIAL_APP_ENV_VARS, SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";
import { fetchTelegramBotInfo } from "@/lib/telegram/bot-info";
import { setEnvVars } from "@/lib/env-file";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    // key -> new value. A blank/empty value leaves that key untouched
    // (don't overwrite an already-saved secret with nothing).
    credentials: z.record(z.string(), z.string()).optional(),
  })
  .strict();

// Super-user only. Merges only the non-empty credential fields sent — a
// platform's other, already-saved keys are left as-is.
export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.socialAppConfig.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse();
  }
  const spec = SOCIAL_APP_SEED.find((s) => s.platform === existing.platform);

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const incoming = parsed.data.credentials ?? {};

  // A Telegram bot token that doesn't verify is worse than no token at all
  // — reject the whole request rather than save it anyway.
  let verifiedBotInfo: { id: string; username: string } | null = null;
  if (existing.platform === "telegram" && incoming.botToken?.trim()) {
    verifiedBotInfo = await fetchTelegramBotInfo(incoming.botToken.trim());
    if (!verifiedBotInfo) {
      return NextResponse.json(
        {
          error: "verification_failed",
          message: "Couldn't verify this token with Telegram — nothing was saved.",
        },
        { status: 400 },
      );
    }
  }

  const current = (existing.credentials as Record<string, string> | null) ?? {};
  const merged = { ...current };
  // Tracks every key that actually changed this request — admin-entered or
  // server-derived — so the .env mirror below covers both, not just what
  // the client sent.
  const changedKeys = new Set<string>();
  for (const [key, value] of Object.entries(incoming)) {
    if (value.trim()) {
      merged[key] = value.trim();
      changedKeys.add(key);
    }
  }

  // The bot's ID and @username aren't admin-entered — a new token gets them
  // resolved from Telegram directly, overwriting whatever was saved before.
  if (verifiedBotInfo) {
    merged.botId = verifiedBotInfo.id;
    merged.botUsername = verifiedBotInfo.username;
    changedKeys.add("botId");
    changedKeys.add("botUsername");
  }

  const updated = await prisma.socialAppConfig.update({
    data: {
      credentials: merged,
      enabled: parsed.data.enabled,
    },
    where: { id },
  });

  // Best-effort mirror into .env — this is what any real consumer reads
  // (see the module doc comment on SOCIAL_APP_ENV_VARS), so the env var is
  // kept in sync with every change made here, not just what the client
  // typed. Never let a broken env file write fail the request that
  // triggered it.
  const envVarsForPlatform = SOCIAL_APP_ENV_VARS[existing.platform];
  const entries: Record<string, string> = {};
  if (envVarsForPlatform) {
    for (const key of changedKeys) {
      const envVar = envVarsForPlatform[key];
      if (envVar) entries[envVar] = merged[key];
    }
  }
  // The callback URL is fixed (not admin-entered) — mirror it every time
  // this platform is saved, so the registered redirect URI in .env always
  // matches this server's real origin.
  if (spec?.callbackPath && spec.callbackEnvVar) {
    entries[spec.callbackEnvVar] = `${request.nextUrl.origin}${spec.callbackPath}`;
  }
  if (Object.keys(entries).length > 0) {
    await setEnvVars(entries).catch(() => {});
  }

  const updatedCredentials = (updated.credentials as Record<string, string> | null) ?? {};
  const textKeys = new Set((spec?.fields ?? []).filter((f) => f.type === "text").map((f) => f.key));
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(updatedCredentials)) {
    if (textKeys.has(key)) values[key] = value;
  }

  return NextResponse.json({
    socialApp: {
      configuredFields: Object.keys(updatedCredentials),
      enabled: updated.enabled,
      id: updated.id,
      platform: updated.platform,
      updatedAt: updated.updatedAt,
      values,
    },
  });
});
