import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { getOAuthProvider } from "@/lib/marketplace/oauth-providers";
import { prisma } from "@/lib/prisma";

// Best-effort: revokes the grant at the provider (e.g. Google) so a
// disconnected account can't still be used with a copy of the token held
// elsewhere. Never blocks deletion — the row is the source of truth for
// whether DepCut can use the account, and we delete it regardless.
async function revokeAtProvider(platform: string, token: string | null): Promise<void> {
  if (!token) return;
  const provider = getOAuthProvider(platform);
  if (!provider?.revokeUrl) return;
  try {
    await fetch(provider.revokeUrl, {
      body: new URLSearchParams({ token }),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      method: "POST",
    });
  } catch {
    // Best-effort — see doc comment above.
  }
}

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    status: z.enum(["active", "inactive"]).optional(),
    accountName: z.string().trim().min(1).max(160).optional(),
    accountHandle: z.string().trim().max(160).nullable().optional(),
    brandId: z.string().trim().min(1).nullable().optional(),
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
  const existing = await prisma.socialConnection.findUnique({ select: { id: true }, where: { id } });
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

  const updated = await prisma.socialConnection.update({ data: parsed.data, where: { id } });
  const { accessToken, refreshToken, ...connection } = updated;

  return NextResponse.json({
    connection: {
      ...connection,
      hasRefreshToken: Boolean(refreshToken),
      hasToken: Boolean(accessToken),
      tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    },
  });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.socialConnection.findUnique({
    select: { accessToken: true, id: true, platform: true, refreshToken: true },
    where: { id },
  });
  if (!existing) {
    return notFoundResponse();
  }

  await revokeAtProvider(existing.platform, existing.refreshToken ?? existing.accessToken);
  await prisma.socialConnection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
