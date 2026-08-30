const RELOAD_KEY = "cut-chunk-reload-attempted";

/** Whether `error` is the browser failing to fetch a JS chunk — almost
 * always because the site redeployed while this tab was already open (or
 * a link sat unopened long enough) and the loaded HTML still points at
 * chunk hashes the current deployment no longer serves. `reset()` can't
 * fix this: the module resolution already failed and nothing re-fetches
 * it. Only a full reload, which re-fetches the current deployment's HTML
 * and asset manifest, does. */
export function isChunkLoadError(error: Error): boolean {
  return (
    error.name === "ChunkLoadError" ||
    /loading chunk .* failed/i.test(error.message) ||
    /failed to (fetch|load) (dynamically imported module|chunk)/i.test(error.message)
  );
}

/** Pure read of whether this tab already tried a chunk reload — safe to
 * call during render (e.g. a lazy useState initializer) so the "loading
 * the latest version" UI can show on the very first paint, before the
 * effect that actually performs the reload has run. */
export function hasAttemptedChunkReload(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(RELOAD_KEY) === "1";
  } catch {
    return false;
  }
}

/** Reload once per browser tab for a chunk-load error, so a stale page
 * self-heals on its very next render instead of showing a crash screen.
 * Never loops: if the fresh load hits the same error again, this returns
 * false and the caller should fall back to its usual error UI with a
 * manual reload action. */
export function attemptChunkReloadOnce(): boolean {
  if (typeof window === "undefined" || hasAttemptedChunkReload()) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
