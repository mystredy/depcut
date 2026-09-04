import { NextResponse } from "next/server";
import { z } from "zod";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Two starter templates so the page isn't empty on first load — matches the
// reference design's examples, not real assistant behavior.
const SEED_TEMPLATES = [
  {
    model: "gemini-3.5-flash",
    name: "SaaS Business Blueprint Helper",
    role: "Coaches startup founders with pre-structured metrics worksheets",
  },
  {
    model: "gemini-3.5-flash",
    name: "SEO Audit Companion Bot",
    role: "Reads a webpage's text, maps keyword density, and flags meta warnings",
  },
];

// Super-user only. Self-seeds two example templates on first read.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const existing = await prisma.chatTemplate.count();
  if (existing === 0) {
    await prisma.chatTemplate.createMany({ data: SEED_TEMPLATES });
  }

  const templates = await prisma.chatTemplate.findMany({ orderBy: { createdAt: "asc" } });

  return NextResponse.json({ templates });
});

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    role: z.string().trim().max(500).optional(),
    model: z.string().trim().max(120).optional(),
    categoryId: z.string().trim().min(1).optional(),
  })
  .strict();

export const POST = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
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

  const template = await prisma.chatTemplate.create({ data: parsed.data });

  return NextResponse.json({ template });
});
