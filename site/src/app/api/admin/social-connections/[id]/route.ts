import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDonkeySuperUser,
  notFoundResponse,
  withDonkeyAuth,
} from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

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

export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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
      hasToken: Boolean(accessToken),
      tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    },
  });
});

export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  await prisma.socialConnection.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
