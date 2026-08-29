"use client";

/** A raw internal error (a fetch/library message naming an internal URL,
 * status code, or stack detail) isn't something a user should have to read
 * — report it to the admin's Telegram instead, best-effort and
 * non-blocking, and hand the caller a plain message to show in its place.
 * Mirrors cut/lib/backend's reportClientError for the regular site — the
 * Cut editor has its own backend-routed version of this same idea. */
export function reportSiteError(context: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  void fetch("/api/errors/report", {
    body: JSON.stringify({ context, message }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  }).catch(() => {});
  return "Something went wrong. We've been notified — try again in a moment.";
}
