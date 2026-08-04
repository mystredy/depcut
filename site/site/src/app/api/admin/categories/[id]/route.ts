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

const updateCategorySchema = z
  .object({
    emoji: z.string().trim().min(1).max(8).optional(),
    niches: z.string().trim().max(1000).optional(),
  })
  .strict();

// Super-user only: edit a category's emoji/niches text. The name itself is
// the join key everywhere it's used (Submission.niche, Task.category), so it
// isn't editable here — renaming would silently orphan existing rows.
export const PATCH = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.category.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = updateCategorySchema.safeParse(await request.json());
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

  const category = await prisma.category.update({ data: parsed.data, where: { id } });

  return NextResponse.json({ category });
});

export const DELETE = withDonkeyAuth(async (request, context: RouteContext) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id } = await context.params;
  const existing = await prisma.category.findUnique({ select: { id: true }, where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request",
        message: "Can't delete a category that still has tasks assigned to it.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true });
});
