import { NextResponse } from "next/server";

import {
  API_INTEGRATION_DEFAULT_BASE_URLS,
  API_INTEGRATION_ENV_VARS,
  API_INTEGRATION_SEED,
  API_INTEGRATION_WIRED,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";
import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds one row per provider on first read. Never
// returns the raw apiKey — only whether it's set. Also reports whether the
// env var the real adapter code actually reads is set, and whether any
// adapter reads it at all — this table's own apiKey is storage/reference
// only (see the module doc comment), so hasApiKey alone would be
// misleading about what's really in effect.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const existing = await prisma.apiIntegration.count();
  if (existing === 0) {
    await prisma.apiIntegration.createMany({
      data: API_INTEGRATION_SEED.map((provider) => ({
        baseUrl: API_INTEGRATION_DEFAULT_BASE_URLS[provider as ApiIntegrationProvider],
        provider,
      })),
    });
  }

  const rows = await prisma.apiIntegration.findMany({ orderBy: { provider: "asc" } });
  const integrations = rows.map(({ apiKey, ...rest }) => {
    const envVars = API_INTEGRATION_ENV_VARS[rest.provider as ApiIntegrationProvider] ?? [];
    return {
      ...rest,
      envConfigured: envVars.some((name) => Boolean(process.env[name]?.trim())),
      envVarNames: envVars,
      hasApiKey: Boolean(apiKey),
      wired: API_INTEGRATION_WIRED[rest.provider as ApiIntegrationProvider] ?? false,
    };
  });

  return NextResponse.json({ integrations });
});
