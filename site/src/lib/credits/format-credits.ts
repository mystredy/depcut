// The pay-as-you-go balance and buy-credit presets display as "credits" at
// an admin-configurable rate (AppSettings.creditRateCredits /
// creditRateDollars, edited from admin/settings/general and exposed via
// usePublicSiteSettings()) — a purely cosmetic conversion. Stripe still
// charges whole dollars and the ledger still stores real dollars
// (lib/credits/amounts.ts, lib/credits/top-up.ts's presets); this only
// converts the number shown on screen. DEFAULT_CREDIT_RATE matches the
// AppSettings column defaults, for callers rendered before the rate loads.
export type CreditRate = { credits: number; dollars: number };

export const DEFAULT_CREDIT_RATE: CreditRate = { credits: 1000, dollars: 3 };

export function dollarsToCredits(dollars: number, rate: CreditRate = DEFAULT_CREDIT_RATE): number {
  return Math.round(dollars * (rate.credits / rate.dollars));
}

// The inverse, for a form field that takes credits but still has to submit a
// whole-dollar amount (Stripe, the ledger, and the auto-reload API all deal
// in whole dollars — see amounts.ts and the auto-reload route's z.number().int()).
// Round-trips cleanly for any value dollarsToCredits produced at the same rate.
export function creditsToDollars(credits: number, rate: CreditRate = DEFAULT_CREDIT_RATE): number {
  return Math.round(credits * (rate.dollars / rate.credits));
}

// null/undefined → an em dash (no value yet); a non-numeric string → "0
// credits"; otherwise the credit count with a thousands separator.
export function formatCredits(
  value: string | null | undefined,
  rate: CreditRate = DEFAULT_CREDIT_RATE,
): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const dollars = Number.parseFloat(value);
  if (!Number.isFinite(dollars)) {
    return "0 credits";
  }
  return `${dollarsToCredits(dollars, rate).toLocaleString("en-US")} credits`;
}
