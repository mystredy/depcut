import { unstable_cache } from "next/cache";
import { cache } from "react";

import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

// Everything admin/settings/general exposes that's safe for a signed-out
// visitor to read: not adminEmail (the operator's own notification address),
// and not any of the raw image bytes (those have their own routes — see
// SiteConfig.prisma's AppSettings for the full field list and why).
const PUBLIC_SELECT = {
  allowRegistration: true,
  appName: true,
  betaMode: true,
  contactEmail: true,
  cookiePolicyUrl: true,
  copyrightText: true,
  dateFormat: true,
  defaultLocale: true,
  defaultTheme: true,
  description: true,
  footerText: true,
  helpCenterUrl: true,
  accentColor: true,
  maintenanceFooter: true,
  maintenanceHeader: true,
  maintenanceMode: true,
  maintenanceParagraph: true,
  privacyUrl: true,
  socialLinks: true,
  supportEmail: true,
  tagline: true,
  termsUrl: true,
  timeFormat: true,
  timezone: true,
  websiteUrl: true,
} as const;

export type PublicSiteSettings = {
  allowRegistration: boolean;
  appName: string;
  betaMode: boolean;
  contactEmail: string | null;
  cookiePolicyUrl: string | null;
  copyrightText: string | null;
  dateFormat: string;
  defaultLocale: string;
  defaultTheme: string;
  description: string | null;
  footerText: string | null;
  helpCenterUrl: string | null;
  accentColor: string | null;
  maintenanceFooter: string | null;
  maintenanceHeader: string | null;
  maintenanceMode: boolean;
  maintenanceParagraph: string | null;
  privacyUrl: string | null;
  socialLinks: Record<string, string> | null;
  supportEmail: string | null;
  tagline: string | null;
  termsUrl: string | null;
  timeFormat: string;
  timezone: string;
  websiteUrl: string | null;
};

const DEFAULTS: PublicSiteSettings = {
  allowRegistration: true,
  appName: "DepCut",
  betaMode: false,
  contactEmail: null,
  cookiePolicyUrl: null,
  copyrightText: null,
  dateFormat: "MM/DD/YYYY",
  defaultLocale: "en-US",
  defaultTheme: "system",
  description: null,
  footerText: null,
  helpCenterUrl: null,
  accentColor: null,
  maintenanceFooter: null,
  maintenanceHeader: null,
  maintenanceMode: false,
  maintenanceParagraph: null,
  privacyUrl: null,
  socialLinks: null,
  supportEmail: null,
  tagline: null,
  termsUrl: null,
  timeFormat: "12h",
  timezone: "UTC",
  websiteUrl: null,
};

/** The raw read, no memoization. A missing row (nobody has saved settings
 * yet) reads as the same defaults GET /api/admin/settings would create on
 * first read, without writing anything — a signed-out page render has no
 * business creating that row.
 *
 * This is read from the root layout, so a DB hiccup here would otherwise
 * take down every single page rather than just the settings that depend on
 * it — falling back to defaults on any error is what keeps a database blip
 * from being a site-wide outage. It's also what keeps `next build` able to
 * statically prerender pages (like /_not-found) in an environment with no
 * reachable database at all, this one included. */
async function fetchPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const row = await prisma.appSettings.findUnique({
      select: PUBLIC_SELECT,
      where: { id: SINGLETON_ID },
    });
    if (!row) return DEFAULTS;
    return { ...DEFAULTS, ...row, socialLinks: (row.socialLinks as Record<string, string> | null) ?? null };
  } catch {
    return DEFAULTS;
  }
}

/** The public half of AppSettings, read directly for a server-rendered
 * surface (root layout, ThemeScript's caller, the opengraph-image routes) —
 * no self-fetch, since those already run in the same Node process this
 * reads from.
 *
 * Every page renders through the root layout, so an uncached read here
 * would mean every page in the app loses static optimization and pays a DB
 * round trip on every request just to answer "what's the site's name" —
 * unstable_cache holds the answer for a minute (an admin's change lands
 * within that, not instantly — matches this settings row's own low churn),
 * and cache() on top dedupes repeat asks within one render tree (the root
 * layout and ThemeScript's caller both ask).
 *
 * proxy.ts calls fetchPublicSiteSettings directly instead, with its own
 * short in-memory cache: it runs before any React render starts, outside
 * the request context both layers above depend on. */
export const publicSiteSettings = cache(
  unstable_cache(fetchPublicSiteSettings, ["public-site-settings"], { revalidate: 60 })
);

export { fetchPublicSiteSettings };
