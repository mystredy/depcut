import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SettingsShell } from "@/app/depcutvision/settings/SettingsShell";
import { AppSurfaceBackground } from "@/components/AppSurfaceBackground";
import { ThemeProvider } from "@/cut/components/ThemeProvider";
import { ThemeScript } from "@/cut/components/ThemeScript";
import { publicSiteSettings } from "@/lib/siteSettings";

export const metadata: Metadata = {
  title: "Settings | DepCut",
  description: "Manage your Vision API subscription and API keys.",
};

// QueryProvider is mounted once at the root layout, so the settings UI just
// needs its session-guarded shell here. This is an app surface like the Cut
// app's own (white in light mode, dark in dark mode) rather than the cream
// landing background the Vision marketing page one segment up keeps — shares
// the same ThemeProvider/ThemeScript so a dark preference set in either app
// carries over instead of leaving dark-mode text on a background that never
// left light mode.
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const { defaultTheme } = await publicSiteSettings();
  return (
    <ThemeProvider>
      <ThemeScript defaultTheme={defaultTheme} />
      <div className="min-h-screen bg-background font-system text-foreground">
        <AppSurfaceBackground />
        <SettingsShell>{children}</SettingsShell>
      </div>
    </ThemeProvider>
  );
}
