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
    apiKey: z.string().trim().min(1).max(500).optional(),
    baseUrl: z.string().trim().max(500).optional(),
    status: z.enum(["Active", "Disabled"]).optional(),
    autoFailover: z.boolean().optional(),
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
  const existing = await prisma.apiIntegration.findUnique({ select: { id: true }, where: { id } });
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
  const { apiKey: _omit, ...integration } = updated;

  return NextResponse.json({ integration: { ...integration, hasApiKey: Boolean(updated.apiKey) } });
});
