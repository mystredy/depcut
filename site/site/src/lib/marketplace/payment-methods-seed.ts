// The site's payout rails. The PaymentMethod table self-seeds one disabled
// row per provider from this list on first read — admins fill in credentials
// from /admin/finance/payment-api, and see/enable the resulting rail from
// the overview table at /admin/finance/payment-methods.
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

// What each rail actually settles in — informational only (not admin-edited
// yet), shown as the overview table's Currency column.
export const PAYMENT_PROVIDER_CURRENCY: Record<PaymentProvider, string> = {
  cryptomus: "USDT / USDC",
  paypal: "USD",
  wise: "Multi-currency",
  flutterwave: "NGN + more",
  paystack: "NGN / GHS / ZAR",
};

// Every credential a rail needs before it can actually take a payment — an
// "enabled" provider missing one of these would just fail at charge time.
// Shared by the overview table's Status column and the credentials editor's
// enable toggle, so the two pages agree on what "ready" means.
export function isPaymentMethodReady(
  provider: PaymentProvider,
  flags: { hasPublicKey: boolean; hasSecretKey: boolean; hasPayoutKey: boolean; hasWebhookSecret: boolean }
): boolean {
  return (
    flags.hasPublicKey &&
    flags.hasSecretKey &&
    flags.hasWebhookSecret &&
    (provider !== "cryptomus" || flags.hasPayoutKey)
  );
}

// Which of this server's .env vars each DB field mirrors, per provider —
// saving a credential in the admin panel also writes it here (see
// /api/admin/payment-methods/[id], same pattern as the API Integrations
// panel). Only Cryptomus is mapped today; a provider missing from this
// table is DB-storage only, same as before.
export const PAYMENT_METHOD_ENV_VARS: Partial<
  Record<PaymentProvider, Partial<Record<"publicKey" | "secretKey" | "payoutKey" | "merchantId" | "webhookSecret", string>>>
> = {
  cryptomus: {
    merchantId: "CRYPTOMUS_Merchant_ID",
    secretKey: "CRYPTOMUS_Payment_API_Key",
    payoutKey: "CRYPTOMUS_Payout_API_Key",
    webhookSecret: "CRYPTOMUS_Webhook_IPN_Endpoint",
  },
};
