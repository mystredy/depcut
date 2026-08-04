// The site's payout rails. The PaymentMethod table self-seeds one disabled
// row per provider from this list on first read — admins turn them on and
// fill in credentials from /admin/finance/payment-methods.
export const PAYMENT_METHOD_SEED = [
  "cryptomus",
  "paypal",
  "wise",
  "flutterwave",
  "paystack",
] as const;

export type PaymentProvider = (typeof PAYMENT_METHOD_SEED)[number];

export const PAYMENT_PROVIDER_LABELS: Record<PaymentProvider, string> = {
  cryptomus: "Cryptomus",
  paypal: "PayPal",
  wise: "Wise",
  flutterwave: "Flutterwave",
  paystack: "Paystack",
};

export const PAYMENT_PROVIDER_DESCRIPTIONS: Record<PaymentProvider, string> = {
  cryptomus: "Crypto payouts (USDT/USDC and other chains) via Cryptomus.",
  paypal: "PayPal payouts to a creator's PayPal email.",
  wise: "Bank transfer payouts via Wise.",
  flutterwave: "African payment rails (bank transfer, mobile money) via Flutterwave.",
  paystack: "African payment rails via Paystack.",
};
