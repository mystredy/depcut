import { NextResponse } from "next/server";

import {
  API_INTEGRATION_DEFAULT_BASE_URLS,
  API_INTEGRATION_SEED,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";
import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Self-seeds one row per provider on first read. Never
// returns the raw apiKey — only whether it's set.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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
  const integrations = rows.map(({ apiKey, ...rest }) => ({
    ...rest,
    hasApiKey: Boolean(apiKey),
  }));

  return NextResponse.json({ integrations });
});
