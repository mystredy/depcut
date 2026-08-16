import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every command the webhook at /api/telegram/webhook will
// match an incoming message against.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const commands = await prisma.telegramCommand.findMany({ orderBy: { trigger: "asc" } });
  return NextResponse.json({ commands });
});

const createSchema = z
  .object({
    trigger: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^\/\S+$/, "Must start with / and have no spaces, e.g. /start"),
    replyText: z.string().trim().min(1).max(4000),
    enabled: z.boolean().optional(),
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

  const existing = await prisma.telegramCommand.findUnique({
    where: { trigger: parsed.data.trigger },
  });
  if (existing) {
    return NextResponse.json(
      { error: "duplicate_trigger", message: `${parsed.data.trigger} already exists.` },
      { status: 409 },
    );
  }

  const command = await prisma.telegramCommand.create({ data: parsed.data });
  return NextResponse.json({ command });
});
