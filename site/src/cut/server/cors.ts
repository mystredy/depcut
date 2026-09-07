/**
 * One CORS policy for Cut's engine, shared by the Next dev server (src/proxy.ts)
 * and the packaged engine's http server (src/cut/engine/serve.ts). Only these
 * hosted Cut origins may reach the engine cross-origin; every other origin is
 * refused before any handler runs. depcut.app runs alongside depcut.com (see
 * the allowedHosts comment in lib/auth.ts), so it needs the same grant.
 */
export const CUT_CLIENT_ORIGINS = new Set([
  "https://depcut.com",
  "https://depcut.app",
  "https://www.depcut.app",
]);

/** The echo-back origin for an allowed caller, else null. */
export function allowedOrigin(origin: string): string | null {
  return CUT_CLIENT_ORIGINS.has(origin) ? origin : null;
}

/** Preflight (OPTIONS) response headers for an allowed origin. */
export function preflightHeaders(
  origin: string,
  requestHeaders: string | null
): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": requestHeaders ?? "Content-Type",
    // Chrome preflights public-site → local-network requests.
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** Response headers that expose an allowed origin on a normal response. */
export function corsHeaders(origin: string): Record<string, string> {
  return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
}
