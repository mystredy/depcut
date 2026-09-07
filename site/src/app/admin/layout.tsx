import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminGuard } from "@/app/admin/AdminGuard";
import { AdminShell } from "@/app/admin/AdminShell";
import { AppSurfaceBackground } from "@/components/AppSurfaceBackground";
import { ThemeProvider } from "@/cut/components/ThemeProvider";
import { ThemeScript } from "@/cut/components/ThemeScript";
import { publicSiteSettings } from "@/lib/siteSettings";

export const metadata: Metadata = {
  title: "Admin | DepCut",
  description: "Site management for DepCut.",
};

// Standalone area outside the Cut app shell (no editor sidebar/header) — its
// own nav, gated to super-user accounts by AdminGuard. Shares the Cut app's
// Light/Dark/System choice (same ThemeProvider, same "cut.theme" localStorage
// key) and marks itself an app surface so a dark preference actually renders
// dark here instead of falling into globals.css's marketing-page fallback.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { defaultTheme } = await publicSiteSettings();
  return (
    <ThemeProvider>
      <ThemeScript defaultTheme={defaultTheme} />
      <div className="flex h-screen bg-background">
        <AppSurfaceBackground />
        <AdminGuard>
          <AdminShell>{children}</AdminShell>
        </AdminGuard>
      </div>
    </ThemeProvider>
  );
}
