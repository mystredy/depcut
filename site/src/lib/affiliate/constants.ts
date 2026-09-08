// Shared between client code (AuthScreen, which sets the cookie) and server
// code (attribute-referral.ts, which reads it) — kept free of node imports
// so it's safe in a "use client" bundle.

// Set client-side by AuthScreen when a visitor lands on /sign-up?ref=CODE,
// read server-side by attribute-referral.ts's user.create hook.
export const AFFILIATE_REF_COOKIE = "depcut_ref";
