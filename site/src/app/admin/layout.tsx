import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminGuard } from "@/app/admin/AdminGuard";
import { AdminShell } from "@/app/admin/AdminShell";

export const metadata: Metadata = {
  title: "Admin | Depcut",
  description: "Site management for Depcut.",
};

// Standalone area outside the Cut app shell (no editor sidebar/header) — its
// own nav, gated to super-user accounts by AdminGuard.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <AdminGuard>
        <AdminShell>{children}</AdminShell>
      </AdminGuard>
    </div>
  );
}
