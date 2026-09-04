import { NextResponse } from "next/server";
import { z } from "zod";

import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// The current user's own creator application, if any — lets the account
// menu's "Apply to be creator" dialog show status instead of the form once
// they've already applied.
export const GET = withDepCutAuth(async (request) => {
  const application = await prisma.creatorApplication.findUnique({
    where: { userId: request.depcut.userId },
  });
  return NextResponse.json({ application });
});

const submitSchema = z
  .object({
    reason: z.string().trim().min(1).max(2_000),
    portfolio: z.string().trim().max(500).optional(),
  })
  .strict();

// Submits (or resubmits, after a rejection) the current user's own creator
// application. One row per user — upsert rather than insert, so a
// resubmission overwrites the prior attempt and resets it to Pending instead
// of piling up a history.
export const POST = withDepCutAuth(async (request) => {
  const parsed = submitSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { reason, portfolio } = parsed.data;
  const userId = request.depcut.userId;

  const existing = await prisma.creatorApplication.findUnique({ where: { userId } });
  if (existing?.status === "Pending") {
    return NextResponse.json(
      { error: "Invalid request", message: "You already have an application pending review." },
      { status: 400 },
    );
  }

  const application = await prisma.creatorApplication.upsert({
    create: { portfolio: portfolio || null, reason, userId },
    update: {
      portfolio: portfolio || null,
      reason,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
      status: "Pending",
    },
    where: { userId },
  });

  return NextResponse.json({ application }, { status: 201 });
});
