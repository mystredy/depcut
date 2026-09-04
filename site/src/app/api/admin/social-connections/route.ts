import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Individually linked accounts available as a publish
// source or destination. No OAuth handshake exists — these are recorded
// manually once an account is connected out-of-band.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const connections = await prisma.socialConnection.findMany({ orderBy: { createdAt: "desc" } });

  return NextResponse.json({
    connections: connections.map(({ accessToken, refreshToken, ...c }) => ({
      ...c,
      hasToken: Boolean(accessToken),
      tokenExpiresAt: c.tokenExpiresAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
});

const createSchema = z
  .object({
    platform: z.string().trim().min(1).max(60),
    accountName: z.string().trim().min(1).max(160),
    accountHandle: z.string().trim().max(160).optional(),
    role: z.enum(["source", "destination"]).default("destination"),
    tokenExpiresAt: z.string().trim().max(40).optional(),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createSchema.safeParse(await request.json());
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

  const { tokenExpiresAt, ...rest } = parsed.data;
  const connection = await prisma.socialConnection.create({
    data: { ...rest, tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined },
  });

  return NextResponse.json({
    connection: {
      ...connection,
      tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
      createdAt: connection.createdAt.toISOString(),
      updatedAt: connection.updatedAt.toISOString(),
    },
  });
});
