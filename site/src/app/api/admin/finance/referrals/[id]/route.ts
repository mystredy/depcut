import { NextResponse } from "next/server";
import { z } from "zod";

import {
  isDepCutSuperUser,
  notFoundResponse,
  withDepCutAuth,
} from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// id here is the ReferralCommission's userId primary key.
type RouteContext = { params: Promise<{ id: string }> };

const settleSchema = z.object({ action: z.literal("settle") }).strict();

export const PATCH = withDepCutAuth(async (request, context: RouteContext) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const { id: userId } = await context.params;
  const existing = await prisma.referralCommission.findUnique({
    include: { user: { select: { displayName: true, name: true } } },
    where: { userId },
  });
  if (!existing) {
    return notFoundResponse();
  }

  const parsed = settleSchema.safeParse(await request.json());
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

  const diff = existing.commissionEarned - existing.commissionPaid;
  if (diff <= 0) {
    return NextResponse.json(
      { error: "Invalid request", message: "No outstanding commission to settle." },
      { status: 400 },
    );
  }
  const userName = existing.user.displayName || existing.user.name;

  const [referral] = await prisma.$transaction([
    prisma.referralCommission.update({
      data: { commissionPaid: existing.commissionEarned },
      where: { userId },
    }),
    prisma.financeTransaction.create({
      data: {
        amount: diff,
        details: `Paid outstanding referral commission balance of $${diff.toFixed(2)}`,
        status: "Completed",
        type: "Referral",
        userId,
        userName,
      },
    }),
  ]);

  return NextResponse.json({ referral });
});
