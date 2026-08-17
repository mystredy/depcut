import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Chat categories, newest first, with a live count of the
// templates linked to each.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const categories = await prisma.chatCategory.findMany({
    include: { _count: { select: { templates: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    categories: categories.map((c) => ({
      description: c.description,
      id: c.id,
      name: c.name,
      templateCount: c._count.templates,
    })),
  });
});

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
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

  const category = await prisma.chatCategory.create({ data: parsed.data });

  return NextResponse.json({ category });
});
