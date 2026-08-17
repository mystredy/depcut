import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminGuard } from "@/app/admin/AdminGuard";
import { AdminNav } from "@/app/admin/AdminNav";

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

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminNav />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-8">{children}</div>
      </main>
    </>
  );
}
