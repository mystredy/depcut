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

const connectionSelect = {
  accountHandle: true,
  accountName: true,
  id: true,
  platform: true,
} as const;

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    username: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-zA-Z0-9_.]+$/, "Letters, numbers, underscores, and periods only")
      .optional(),
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
  const existing = await prisma.brand.findUnique({ select: { id: true }, where: { id } });
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

  try {
    const { logo, logoContentType: _logoContentType, ...brand } = await prisma.brand.update({
      data: parsed.data,
      include: { connections: { select: connectionSelect } },
      where: { id },
    });
    return NextResponse.json({
      brand: {
        ...brand,
        createdAt: brand.createdAt.toISOString(),
        hasLogo: Boolean(logo),
        updatedAt: brand.updatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request", issues: [{ message: "That name or username is already taken.", path: "name" }] },
      { status: 400 },
    );
  }
});

export const DELETE = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.brand.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  await prisma.brand.delete({ where: { id } });

  return NextResponse.json({ ok: true });
});
