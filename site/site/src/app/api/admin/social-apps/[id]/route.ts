import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";
import { SOCIAL_APP_SEED } from "@/lib/marketplace/social-apps-seed";

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
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  const current = (existing.credentials as Record<string, string> | null) ?? {};
  const incoming = parsed.data.credentials ?? {};
  const merged = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    if (value.trim()) merged[key] = value.trim();
  }

  const updated = await prisma.socialAppConfig.update({
    data: {
      credentials: merged,
      enabled: parsed.data.enabled,
    },
    where: { id },
  });

  const updatedCredentials = (updated.credentials as Record<string, string> | null) ?? {};
  const textKeys = new Set(
    (SOCIAL_APP_SEED.find((s) => s.platform === updated.platform)?.fields ?? [])
      .filter((f) => f.type === "text")
      .map((f) => f.key)
  );
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
