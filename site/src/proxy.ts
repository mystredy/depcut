import { NextResponse, type NextRequest } from "next/server";

import { allowedOrigin, corsHeaders, preflightHeaders } from "@/cut/server/cors";
import {
  DEPCUT_CANONICAL,
  isDepCutHost,
  isLocalHost,
} from "@/cut/lib/hosts";
import { auth } from "@/lib/auth";
import { isDepCutSuperUser } from "@/lib/depcut-api-auth";
import { fetchPublicSiteSettings } from "@/lib/siteSettings";

// Cut (the video editor, publicly "DepCut") lives under /cut in this single
// site app: the marketing landing at /cut and the app under /cut/app. Every
// host gets the same mapping — "/" → landing, "/app/…" → editor app (generic
// "/…" → "/cut/…" rewrite) — with depcut.com as the one production host.
// The auth pages (/sign-in, /sign-up), "/install", "/depcutvision", and the
// legal pages are real root-level routes and pass through the rewrite.
// www. 308s to the apex; retired domains redirect to depcut.com at the
// edge (Cloudflare) and never reach this app.
//
// This file must live in src/ (next to app/) and use the Next 16 `proxy` name;
// a root-level middleware.ts is not loaded when the app is under src/.

// Cut's server APIs are local-only (see src/cut/server/local-only.ts): the
// hosted deploy serves only Cut's client bundle, and that page drives the
// engine running on the user's own Mac. Two rules follow:
//  - hosted: these API paths 404 before any handler runs, so no Cut server
//    code (disk, ffmpeg, the user's AI CLIs) can execute off-Mac and the
//    unauthenticated routes are unreachable.
//  - local: the page served from the hosted origin calls this engine
//    cross-origin, so grant exactly that origin CORS.
const CUT_API_PREFIX = "/api/cut";
const HOSTED = Boolean(process.env.VERCEL);

const isCutApi = (pathname: string) =>
  pathname === CUT_API_PREFIX || pathname.startsWith(`${CUT_API_PREFIX}/`);

function cutApi(req: NextRequest): NextResponse {
  if (HOSTED) return new NextResponse(null, { status: 404 });

  // Same CORS policy as the packaged engine (src/cut/server/cors.ts): grant the
  // hosted Cut origin, pass everything else through as same-origin dev traffic.
  const cors = allowedOrigin(req.headers.get("origin") ?? "");
  if (!cors) return NextResponse.next();

  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: preflightHeaders(cors, req.headers.get("access-control-request-headers")),
    });
  }
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(corsHeaders(cors))) res.headers.set(k, v);
  return res;
}

// Root-level routes the generic "/…" → "/cut/…" rewrite must not capture:
// auth pages, the Mac download, DepCut Vision (marketing, settings, and API
// docs), the site admin panel, and the legal pages. "/app/settings" is not
// among them: Cut ships its own billing and usage pages under
// /cut/app/settings, which the generic rewrite serves at /app/settings.
// The four icon/social-image routes are Next's own file-convention paths
// (site/src/app/icon.tsx and friends) — they have no extension in the URL,
// so unlike the old static favicon.ico (excluded by the matcher's own dot
// check below) they'd otherwise be rewritten to a nonexistent /cut/icon.
const PASSTHROUGH = [
  "/install",
  "/privacy",
  "/terms",
  "/sign-in",
  "/sign-up",
  "/depcutvision",
  "/admin",
  "/icon",
  "/apple-icon",
  "/opengraph-image",
  "/twitter-image",
];

// What maintenance mode still has to serve regardless of who's asking:
// "/sign-in" so a super user can get a session in the first place, and every
// icon/share-image route is chrome, not content, so a maintenance visitor's
// tab still gets a real favicon instead of a 503. Narrower than PASSTHROUGH
// on purpose — "closed to visitors" means /install, /sign-up, and the legal
// pages gate too, even though the rewrite lets them through untouched
// otherwise. A signed-in super user bypasses the gate everywhere else (see
// below), so "/admin" doesn't need its own entry here anymore.
const MAINTENANCE_BYPASS = ["/sign-in", "/icon", "/apple-icon", "/opengraph-image", "/twitter-image"];

function maintenancePage(header: string | null, paragraph: string | null, footer: string | null): NextResponse {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(header ?? "We'll be right back")}</title>
<style>body{font-family:system-ui,sans-serif;background:#F5EFE6;color:#0F0E0D;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
main{max-width:32rem;text-align:center}h1{font-size:1.75rem;margin:0 0 12px}p{color:#555;line-height:1.5}</style>
</head><body><main><h1>${esc(header ?? "We'll be right back")}</h1>
<p>${esc(paragraph ?? "The site is down for maintenance. Please check back soon.")}</p>
${footer ? `<div>${footer}</div>` : ""}
</main></body></html>`;
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 503,
  });
}

// Whole-segment prefix match, so "/cut" covers "/cut/…" but not "/cut-app".
const underPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

const passesThrough = (pathname: string) =>
  PASSTHROUGH.some((p) => underPath(pathname, p));

// This runs on every page request, so a real DB read per request would size
// the connection pool to the site's traffic rather than to how often anyone
// actually flips this switch. A warm serverless instance reuses this module
// scope across invocations, so most requests answer from here instead —
// still fresh within a few seconds of a real toggle, which is what
// "temporarily unavailable" needs, not instant propagation.
const MAINTENANCE_CACHE_MS = 10_000;
let maintenanceCache: { at: number; settings: Awaited<ReturnType<typeof fetchPublicSiteSettings>> } | null = null;

async function cachedMaintenanceSettings() {
  const now = Date.now();
  if (maintenanceCache && now - maintenanceCache.at < MAINTENANCE_CACHE_MS) {
    return maintenanceCache.settings;
  }
  const settings = await fetchPublicSiteSettings();
  maintenanceCache = { at: now, settings };
  return settings;
}

// Only called while maintenance mode is on, so this doesn't add a DB round
// trip to ordinary traffic — but it does mean the bypass itself now depends
// on the DB being reachable. Swallow any failure into "not a super user"
// (see the caller) instead of letting it propagate and break the maintenance
// page for everyone.
async function isSuperUserSafe(headers: Headers): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers });
    return session ? await isDepCutSuperUser(session.user.id) : false;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isCutApi(pathname)) return cutApi(req);

  const host = req.headers.get("host");

  // Aliases (www.) canonicalize to the apex.
  if (isDepCutHost(host) && host?.split(":")[0] !== "depcut.com") {
    const url = req.nextUrl.clone();
    return NextResponse.redirect(
      `${DEPCUT_CANONICAL}${pathname}${url.search}`,
      308,
    );
  }

  // Legacy direct /cut/… links canonicalize to the rewritten address:
  // /cut/app/… → /app/….
  if (underPath(pathname, "/cut")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice("/cut".length) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (underPath(pathname, "/api")) return NextResponse.next();

  // admin/settings/general's Maintenance Mode toggle, enforced here rather
  // than left for each page to check on its own — one gate before the
  // rewrite below ever picks a destination. Next 16's `proxy` runs on
  // Node.js (unlike old edge middleware), so a direct Prisma read is exactly
  // as available here as anywhere else in this app.
  if (!MAINTENANCE_BYPASS.some((p) => underPath(pathname, p))) {
    const settings = await cachedMaintenanceSettings();
    if (settings.maintenanceMode) {
      // A signed-in super user rides through the closed site entirely —
      // not just /admin — so turning maintenance on never locks the person
      // who'd need to turn it back off out of the app they'd use to check
      // whatever prompted the toggle in the first place. Fails closed: if
      // the session/role lookup itself errors (the DB being unreachable is
      // exactly the kind of thing that might prompt flipping this switch),
      // every visitor — super user included — sees the maintenance page
      // rather than this check taking the page down with it.
      const isSuperUser = await isSuperUserSafe(req.headers);
      if (!isSuperUser) {
        return maintenancePage(
          settings.maintenanceHeader,
          settings.maintenanceParagraph,
          settings.maintenanceFooter,
        );
      }
    }
  }

  if (passesThrough(pathname)) return NextResponse.next();
  // The notch prototype is a dev-only page.
  if (isLocalHost(host) && underPath(pathname, "/prototype")) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname =
    pathname === "/sitemap.xml"
      ? "/cut/sitemap.xml"
      : `/cut${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Page routes (skip Next internals and files with an extension) plus every
  // Cut API path — including media/export files with extensions — so the
  // hosted 404 and local CORS above cover all of them. "/sitemap.xml" is
  // matched explicitly so depcut.com can serve its own sitemap.
  matcher: [
    "/((?!_next/|.*\\..*).*)",
    "/api/cut/:path*",
    "/sitemap.xml",
  ],
};
