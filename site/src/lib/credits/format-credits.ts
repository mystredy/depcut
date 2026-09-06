// The pay-as-you-go balance and buy-credit presets display as "credits" at
// $3 = 1000 credits (1 credit = $0.003), a purely cosmetic conversion —
// Stripe still charges whole dollars and the ledger still stores real
// dollars (lib/credits/amounts.ts, lib/credits/top-up.ts's presets), this
// only converts the number shown on screen.
const CREDITS_PER_DOLLAR = 1000 / 3;

export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * CREDITS_PER_DOLLAR);
}

// The inverse, for a form field that takes credits but still has to submit a
// whole-dollar amount (Stripe, the ledger, and the auto-reload API all deal
// in whole dollars — see amounts.ts and the auto-reload route's z.number().int()).
// Round-trips cleanly for any value dollarsToCredits produced.
export function creditsToDollars(credits: number): number {
  return Math.round(credits / CREDITS_PER_DOLLAR);
}

// null/undefined → an em dash (no value yet); a non-numeric string → "0
// credits"; otherwise the credit count with a thousands separator.
export function formatCredits(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "—";
  }
  const dollars = Number.parseFloat(value);
  if (!Number.isFinite(dollars)) {
    return "0 credits";
  }
  return `${dollarsToCredits(dollars).toLocaleString("en-US")} credits`;
}
