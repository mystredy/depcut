import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { setEnvVar } from "@/lib/env-file";
import {
  API_INTEGRATION_ENV_VARS,
  type ApiIntegrationProvider,
} from "@/lib/marketplace/api-integrations-seed";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    apiKey: z.string().trim().min(1).max(500).optional(),
    baseUrl: z.string().trim().max(500).optional(),
    status: z.enum(["Active", "Disabled"]).optional(),
    autoFailover: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.apiIntegration.findUnique({
    select: { id: true, provider: true },
    where: { id },
  });
  if (!existing) {
    return notFoundResponse();
  }

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

  const { apiKey, ...rest } = parsed.data;
  const updated = await prisma.apiIntegration.update({
    data: { ...rest, ...(apiKey ? { apiKey } : {}) },
    where: { id },
  });

  // Best-effort mirror into this server's local .env — the DB row is
  // reference storage, but this is what actually makes a pasted key take
  // effect without hand-editing the file. Never fails the save: a real
  // production host's env usually isn't a writable file at all.
  if (apiKey) {
    const envVarName = API_INTEGRATION_ENV_VARS[existing.provider as ApiIntegrationProvider]?.[0];
    if (envVarName) {
      await setEnvVar(envVarName, apiKey).catch(() => {});
    }
  }

  const { apiKey: _omit, ...integration } = updated;

  return NextResponse.json({ integration: { ...integration, hasApiKey: Boolean(updated.apiKey) } });
});
