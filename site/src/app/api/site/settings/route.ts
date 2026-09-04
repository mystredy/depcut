import { NextResponse } from "next/server";

import { publicSiteSettings } from "@/lib/siteSettings";

export const dynamic = "force-dynamic";

// Public: the client-rendered surfaces that need site settings without a
// session — the marketing Footer, the beta badge next to the logo. Anything
// server-rendered (root layout, ThemeScript, proxy.ts, the opengraph-image
// routes) calls publicSiteSettings() directly instead of fetching this over
// HTTP — proxy.ts runs on Node.js like everything else here (Next 16's
// `proxy` has no edge runtime), so there's no edge/Node split to bridge.
export const GET = async () => {
  const settings = await publicSiteSettings();
  return NextResponse.json(
    { settings },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
};
