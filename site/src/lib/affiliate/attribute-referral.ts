import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate/constants";
import { notifyUserEverywhere } from "@/lib/notify";
import { prisma } from "@/lib/prisma";

const DEFAULT_COMMISSION_RATES = 100;
const DEFAULT_EXCHANGE_RATE = 0.01;

function readRefCode(headers: Headers | null): string | null {
  const cookieHeader = headers?.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${AFFILIATE_REF_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Credits the referring affiliate for a brand-new signup. Best-effort and
 * never throws — called from auth.ts's user.create hook, which must never
 * block account creation. No-ops silently when there's no ref cookie, the
 * code doesn't match an affiliate, or it's a self-referral; a referredUserId
 * can only ever be attributed once, enforced by AffiliateReferral's unique
 * constraint. */
export async function attributeAffiliateReferral(
  referredUserId: string,
  headers: Headers | null,
): Promise<void> {
  try {
    const code = readRefCode(headers);
    if (!code) return;

    const affiliate = await prisma.affiliate.findUnique({
      select: { user: { select: { displayName: true, name: true } }, userId: true },
      where: { code },
    });
    if (!affiliate || affiliate.userId === referredUserId) return;

    const [settings, exchangeRate] = await Promise.all([
      prisma.financeSettings.findUnique({
        select: { affiliateCommissionRates: true },
        where: { id: "singleton" },
      }),
      prisma.financeExchangeRate.findUnique({
        select: { currentRate: true },
        where: { id: "singleton" },
      }),
    ]);
    const commissionRates = settings?.affiliateCommissionRates ?? DEFAULT_COMMISSION_RATES;
    const usdAmount = commissionRates * (exchangeRate?.currentRate ?? DEFAULT_EXCHANGE_RATE);
    const affiliateName = affiliate.user.displayName ?? affiliate.user.name;

    await prisma.$transaction([
      prisma.affiliateReferral.create({
        data: { affiliateId: affiliate.userId, commissionRates, referredUserId },
      }),
      prisma.creatorRateAccount.upsert({
        create: {
          available: commissionRates,
          lifetime: commissionRates,
          referral: commissionRates,
          userId: affiliate.userId,
        },
        update: {
          available: { increment: commissionRates },
          lifetime: { increment: commissionRates },
          referral: { increment: commissionRates },
        },
        where: { userId: affiliate.userId },
      }),
      prisma.financeTransaction.create({
        data: {
          amount: usdAmount,
          details: "Affiliate signup commission",
          ratesAmount: commissionRates,
          type: "Referral",
          userId: affiliate.userId,
          userName: affiliateName,
        },
      }),
    ]);

    await notifyUserEverywhere({
      body: `You earned ${commissionRates} Rates for a new signup through your referral link.`,
      link: "/app/settings/affiliate",
      title: "Affiliate commission earned",
      userId: affiliate.userId,
    });
  } catch (error) {
    // Same resilience contract as provisionSignupGrants / notifyNewSignup in
    // auth.ts — logged, never thrown, so a lookup failure here can't block
    // the signup it's attached to.
    console.error("[affiliate] attributeAffiliateReferral failed:", error);
  }
}
