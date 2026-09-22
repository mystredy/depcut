import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Which studios (Brand) a Pro artist may submit for — see
// ProSubmissionCodes.prisma. Managed from the Permissions dialog on
// /admin/users, alongside the artist/Pro grant it depends on.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can view this." }, { status: 403 });
  }

  const userId = new URL(request.url).searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "Invalid request", message: "userId is required." }, { status: 400 });
  }

  const assignments = await prisma.artistBrandAssignment.findMany({
    include: { brand: { select: { id: true, name: true, username: true } } },
    orderBy: { createdAt: "asc" },
    where: { userId },
  });

  return NextResponse.json({
    assignments: assignments.map((a) => ({ brand: a.brand, id: a.id })),
  });
});

const writeSchema = z
  .object({
    userId: z.string().trim().min(1),
    brandId: z.string().trim().min(1),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const parsed = writeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", message: "userId and brandId are required." }, { status: 400 });
  }

  const assignment = await prisma.artistBrandAssignment.upsert({
    create: { ...parsed.data, assignedById: request.depcut.userId },
    include: { brand: { select: { id: true, name: true, username: true } } },
    update: {},
    where: { userId_brandId: parsed.data },
  });

  return NextResponse.json({ assignment: { brand: assignment.brand, id: assignment.id } });
});

export const DELETE = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json({ error: "Forbidden", message: "Only super users can do this." }, { status: 403 });
  }

  const parsed = writeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", message: "userId and brandId are required." }, { status: 400 });
  }

  await prisma.artistBrandAssignment.deleteMany({ where: parsed.data });
  return NextResponse.json({ ok: true });
});
