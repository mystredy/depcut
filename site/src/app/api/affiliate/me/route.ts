import { NextResponse } from "next/server";

import { generateAffiliateCode } from "@/lib/affiliate/code";
import { withDepCutAuth } from "@/lib/depcut-api-auth";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const DEFAULT_COMMISSION_RATES = 100;
const DEFAULT_EXCHANGE_RATE = 0.01;
const MAX_CODE_ATTEMPTS = 5;

/** True for a Prisma unique-constraint violation — same pattern
 * api/account/profile/route.ts uses for its own unique inserts. */
function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// The caller's own affiliate program membership, referral link stats, and
// the current commission rate (shown on the join CTA even before joining).
export const GET = withDepCutAuth(async (request) => {
  const userId = request.depcut.userId;

  const [affiliate, settings, exchangeRate] = await Promise.all([
    prisma.affiliate.findUnique({
      select: {
        code: true,
        createdAt: true,
        referrals: {
          orderBy: { createdAt: "desc" },
          select: {
            commissionRates: true,
            createdAt: true,
            id: true,
            referredUser: { select: { displayName: true, image: true, name: true } },
          },
        },
      },
      where: { userId },
    }),
    prisma.financeSettings.findUnique({
      select: { affiliateCommissionRates: true },
      where: { id: "singleton" },
    }),
    prisma.financeExchangeRate.findUnique({
      select: { currentRate: true },
      where: { id: "singleton" },
    }),
  ]);

  const rate = exchangeRate?.currentRate ?? DEFAULT_EXCHANGE_RATE;
  const totalCommissionRates = affiliate?.referrals.reduce((sum, r) => sum + r.commissionRates, 0) ?? 0;

  return NextResponse.json({
    affiliate: affiliate
      ? {
          code: affiliate.code,
          createdAt: affiliate.createdAt,
          referrals: affiliate.referrals.map((r) => ({
            commissionRates: r.commissionRates,
            createdAt: r.createdAt,
            id: r.id,
            referredUserImage: r.referredUser.image,
            referredUserName: r.referredUser.displayName ?? r.referredUser.name,
          })),
        }
      : null,
    commissionRatePerSignup: settings?.affiliateCommissionRates ?? DEFAULT_COMMISSION_RATES,
    stats: {
      referralCount: affiliate?.referrals.length ?? 0,
      totalCommissionRates,
      totalCommissionUsd: totalCommissionRates * rate,
    },
  });
});

// Joins the affiliate program: instant, self-serve, no admin approval — a
// new Affiliate row with a fresh code. Idempotent: calling it again for an
// already-joined user just returns the existing row.
export const POST = withDepCutAuth(async (request) => {
  const userId = request.depcut.userId;

  const existing = await prisma.affiliate.findUnique({
    select: { code: true, createdAt: true },
    where: { userId },
  });
  if (existing) {
    return NextResponse.json({ affiliate: { ...existing, referrals: [] } });
  }

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    try {
      const affiliate = await prisma.affiliate.create({
        data: { code: generateAffiliateCode(), userId },
        select: { code: true, createdAt: true },
      });
      return NextResponse.json({ affiliate: { ...affiliate, referrals: [] } });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }
  }

  return NextResponse.json(
    { error: "server-error", message: "Couldn't generate a referral code. Try again." },
    { status: 500 },
  );
});
