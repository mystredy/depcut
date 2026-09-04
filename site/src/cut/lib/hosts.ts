// Cut is served from one production host, mapped by src/proxy.ts onto the
// real routes under /cut: depcut.com — marketing landing at "/", the app
// at "/app/…" (rewritten to /cut/app/…). Retired domains are redirected to
// depcut.com at the edge (Cloudflare) and never reach this app.
//
// Local dev is deliberately absent from the set: the proxy serves localhost
// the same mapping, keeping the session cookie same-origin on the one dev
// origin.
export const DEPCUT_HOSTS = new Set(["depcut.com", "www.depcut.com"]);

export const DEPCUT_CANONICAL = "https://depcut.com";

// Shared media is served from its own hostname by the Cut Worker's R2 binding
// (src/cut/worker/cf/media.ts), never by this app. The Worker claims it as a
// custom domain in wrangler.jsonc; change that route and this together.
// Overridable per deployment: a fork without that custom domain points this at
// its own Worker (e.g. its workers.dev URL) via env instead.
export const CUT_MEDIA_HOST = process.env.CUT_MEDIA_HOST || "media.depcut.com";
export const CUT_MEDIA_ORIGIN = `https://${CUT_MEDIA_HOST}`;

// The Cut Worker's control plane — the /wake the hosted API posts to when it
// queues a render. Its own custom domain, claimed in wrangler.jsonc beside the
// media route, so it cannot be revoked by a deploy default the way the
// workers.dev address was: adding the media route turned workers.dev off and
// stranded every render for two days, with nothing to see but queued jobs.
// Overridable the same way as CUT_MEDIA_HOST above.
export const CUT_WORKER_HOST = process.env.CUT_WORKER_HOST || "worker.depcut.com";
export const CUT_WORKER_WAKE_URL = `https://${CUT_WORKER_HOST}/wake`;

function hostname(host: string | null | undefined): string {
  return host ? host.split(":")[0] : "";
}

export function isDepCutHost(host: string | null | undefined): boolean {
  return DEPCUT_HOSTS.has(hostname(host));
}

// Local dev serves DepCut by default: the proxy gives localhost the same
// "/…" → "/cut/…" mapping as depcut.com (see src/proxy.ts).
export function isLocalHost(host: string | null | undefined): boolean {
  const name = hostname(host);
  return name === "localhost" || name === "127.0.0.1";
}
