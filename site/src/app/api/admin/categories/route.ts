import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    emoji: z.string().trim().min(1).max(8),
  })
  .strict();

// Super-user only: add a new main category. Niches start empty — add them
// from the category card afterward.
export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = createCategorySchema.safeParse(await request.json());
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

  const existing = await prisma.category.findUnique({
    select: { id: true },
    where: { name: parsed.data.name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Invalid request", issues: [{ message: "That category already exists.", path: "name" }] },
      { status: 400 },
    );
  }

  const count = await prisma.category.count();
  const category = await prisma.category.create({
    data: { ...parsed.data, niches: "", sortOrder: count },
  });

  return NextResponse.json({ category });
});
