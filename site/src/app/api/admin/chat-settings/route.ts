import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SINGLETON_ID = "singleton";

// Super-user only. Admin-configured chat assistant defaults — not read by
// the real inference path yet.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const settings = await prisma.chatSettings.upsert({
    create: { id: SINGLETON_ID },
    update: {},
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});

const updateSchema = z
  .object({
    defaultModel: z.string().trim().min(1).max(120).optional(),
    temperature: z.number().int().min(0).max(150).optional(),
    maxOutputTokens: z.number().int().min(1).max(200000).optional(),
    streamOutput: z.boolean().optional(),
  })
  .strict();

export const PATCH = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
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

  const settings = await prisma.chatSettings.upsert({
    create: { id: SINGLETON_ID, ...parsed.data },
    update: parsed.data,
    where: { id: SINGLETON_ID },
  });

  return NextResponse.json({ settings });
});
