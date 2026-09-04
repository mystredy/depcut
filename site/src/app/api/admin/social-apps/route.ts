import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";
import { SOCIAL_APP_ENV_VARS, SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds one disabled row per platform on every read —
// skipDuplicates makes this a no-op for platforms that already have a row,
// so a platform added to SOCIAL_APP_SEED later still gets seeded in without
// a full reset. Secret ("password") fields never leave the server — only
// which ones are set (configuredFields). Non-secret ("text") fields like a
// Telegram username aren't credentials, so their actual saved value comes
// back in `values` for the admin form to show and edit.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  await prisma.socialAppConfig.createMany({
    data: SOCIAL_APP_SEED.map((s) => ({ platform: s.platform })),
    skipDuplicates: true,
  });

  const rows = await prisma.socialAppConfig.findMany({ orderBy: { platform: "asc" } });
  const specByPlatform = new Map(SOCIAL_APP_SEED.map((s) => [s.platform, s]));

  return NextResponse.json({
    socialApps: rows.map((r) => {
      const credentials = (r.credentials as Record<string, string> | null) ?? {};
      const textKeys = new Set(
        (specByPlatform.get(r.platform)?.fields ?? [])
          .filter((f) => f.type === "text")
          .map((f) => f.key)
      );
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(credentials)) {
        if (textKeys.has(key)) values[key] = value;
      }

      const envVarsForPlatform = SOCIAL_APP_ENV_VARS[r.platform];
      const envConfigured = envVarsForPlatform
        ? Object.values(envVarsForPlatform).every((name) => Boolean(name && process.env[name]?.trim()))
        : undefined;

      return {
        configuredFields: Object.keys(credentials),
        enabled: r.enabled,
        envConfigured,
        id: r.id,
        platform: r.platform,
        updatedAt: r.updatedAt,
        values,
      };
    }),
  });
});
