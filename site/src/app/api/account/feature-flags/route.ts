import { NextResponse } from "next/server";

import {
  withDepCutAuth,
  type DepCutAuthenticatedRequest,
} from "@/lib/depcut-api-auth";
import { ACCOUNT_FEATURE_FLAGS, isKnownFeatureFlag } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

// The signed-in account's feature flags: the full registry with each flag's
// enabled state. Rows exist only for flags the user has touched; everyone else
// gets the flag's registry default.
export const GET = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const rows = await prisma.userFeatureFlag.findMany({
    where: { userId: request.depcut.userId },
  });
  const enabled = new Map(rows.map((r) => [r.flag, r.enabled]));
  return NextResponse.json({
    flags: ACCOUNT_FEATURE_FLAGS.map((f) => ({
      ...f,
      enabled: enabled.get(f.id) ?? f.defaultEnabled,
    })),
  });
});

export const PUT = withDepCutAuth(async (request: DepCutAuthenticatedRequest) => {
  const body = (await request.json().catch(() => null)) as {
    flag?: string;
    enabled?: boolean;
  } | null;
  if (!body?.flag || typeof body.enabled !== "boolean" || !isKnownFeatureFlag(body.flag)) {
    return NextResponse.json({ error: "Unknown flag." }, { status: 400 });
  }
  const userId = request.depcut.userId;
  await prisma.userFeatureFlag.upsert({
    where: { userId_flag: { userId, flag: body.flag } },
    create: { userId, flag: body.flag, enabled: body.enabled },
    update: { enabled: body.enabled },
  });
  return NextResponse.json({ ok: true, flag: body.flag, enabled: body.enabled });
});
