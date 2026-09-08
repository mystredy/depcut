import { NextResponse } from "next/server";

import { isDepCutSuperUser, withDepCutAuth } from "@/lib/depcut-api-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Super-user only. Every affiliate, with real referral counts and commission
// totals computed from AffiliateReferral rows — unlike Finance.prisma's
// older ReferralCommission ledger, this is live attribution, not hand entry.
export const GET = withDepCutAuth(async (request) => {
  if (!(await isDepCutSuperUser(request.depcut.userId))) {
    return NextResponse.json(
      { error: "Forbidden", message: "Only super users can view this." },
      { status: 403 },
    );
  }

  const affiliates = await prisma.affiliate.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      code: true,
      createdAt: true,
      referrals: { select: { commissionRates: true } },
      user: { select: { displayName: true, email: true, image: true, name: true } },
      userId: true,
    },
  });

  return NextResponse.json({
    affiliates: affiliates.map((a) => ({
      code: a.code,
      createdAt: a.createdAt,
      referralCount: a.referrals.length,
      totalCommissionRates: a.referrals.reduce((sum, r) => sum + r.commissionRates, 0),
      userEmail: a.user.email,
      userId: a.userId,
      userImage: a.user.image,
      userName: a.user.displayName ?? a.user.name,
    })),
  });
});
