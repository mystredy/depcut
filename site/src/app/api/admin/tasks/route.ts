import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every Inspire-mode task campaign. The creator-facing
// Inspiration board doesn't read from this table yet (it's seeded locally —
// see src/app/cut/app/(home)/creator-hub/inspiration/page.tsx) but this is
// the real table it's meant to eventually read from.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const tasks = await prisma.task.findMany({
    include: { category: { select: { emoji: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ tasks });
});

const createSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    categoryId: z.string().trim().min(1),
    niche: z.string().trim().max(80).optional(),
    script: z.string().trim().max(2000).optional(),
    instructions: z.string().trim().max(2000).optional(),
    maxRates: z.number().int().min(1).max(20),
    hoursToComplete: z.number().int().min(1).max(48),
    additionalRevenueReward: z.boolean(),
    requiredArtists: z.array(z.string().trim().min(1)).max(50).default([]),
    fullClip: z.string().trim().max(2000).optional(),
    shortClip: z.string().trim().max(2000).optional(),
  })
  .strict();

export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
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

  const { hoursToComplete, ...rest } = parsed.data;
  const deadline = new Date(Date.now() + hoursToComplete * 60 * 60 * 1000);

  const task = await prisma.task.create({
    data: {
      ...rest,
      deadline,
      // Task.description is the required long-form field; instructions is
      // the optional admin-facing detail. Reuse instructions when set so
      // creators still see something meaningful, without a duplicate field.
      description: rest.instructions ?? rest.title,
      hoursToComplete,
    },
    include: { category: { select: { emoji: true, name: true } } },
  });

  return NextResponse.json({ task });
});
