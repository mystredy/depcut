import { NextResponse } from "next/server";
import { z } from "zod";

import { isDonkeySuperUser, withDonkeyAuth } from "@/lib/donkey-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Manually-recorded referral commissions — see
// Finance.prisma's ReferralCommission comment.
export const GET = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const rows = await prisma.referralCommission.findMany({
    include: { user: { select: { displayName: true, name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const referrals = rows.map((r) => ({ ...r, userName: r.user.displayName || r.user.name }));

  return NextResponse.json({ referrals });
});

// One row per user — creates it if missing, otherwise overwrites the stats.
const upsertSchema = z
  .object({
    userId: z.string().trim().min(1),
    referralCount: z.number().int().min(0),
    commissionEarned: z.number().min(0),
    activeReferrals: z.number().int().min(0),
    expiredReferrals: z.number().int().min(0),
  })
  .strict();

export const POST = withDonkeyAuth(async (request) => {
  if (!(await isDonkeySuperUser(request.donkey.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can do this." },
      { status: 403 },
    );
  }

  const parsed = upsertSchema.safeParse(await request.json());
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

  const { userId, ...stats } = parsed.data;
  const referral = await prisma.referralCommission.upsert({
    create: { userId, ...stats },
    update: stats,
    where: { userId },
  });

  return NextResponse.json({ referral });
});
