import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    trigger: z
      .string()
      .trim()
      .min(2)
      .max(60)
      .regex(/^\/\S+$/, "Must start with / and have no spaces, e.g. /start")
      .optional(),
    replyText: z.string().trim().min(1).max(4000).optional(),
    enabled: z.boolean().optional(),
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
  const existing = await prisma.telegramCommand.findUnique({ where: { id } });
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

  if (parsed.data.trigger && parsed.data.trigger !== existing.trigger) {
    const clash = await prisma.telegramCommand.findUnique({
      where: { trigger: parsed.data.trigger },
    });
    if (clash) {
      return NextResponse.json(
        { error: "duplicate_trigger", message: `${parsed.data.trigger} already exists.` },
        { status: 409 },
      );
    }
  }

  const command = await prisma.telegramCommand.update({ data: parsed.data, where: { id } });
  return NextResponse.json({ command });
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.telegramCommand.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  await prisma.telegramCommand.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
