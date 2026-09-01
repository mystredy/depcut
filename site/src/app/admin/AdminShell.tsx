"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";

import { AdminNav, findAdminNavItem } from "@/app/admin/AdminNav";
import { cn } from "@/lib/utils";

// Most admin pages are forms and short lists that read better centered and
// narrow. A page whose content is inherently wide (a data table with enough
// columns that centering it just forces a horizontal scrollbar inside a
// half-empty card) opts out here instead of fighting the shared max-width.
const FULL_WIDTH_ROUTES = new Set(["/admin/users"]);

// The collapse toggle lives once, in this header strip, rather than as a
// separate control inside the sidebar (expanded) plus a thin left-edge rail
// (collapsed) — one affordance, same place, either way.
export function AdminShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const current = findAdminNavItem(pathname);
  const Icon = current?.icon;
  const fullWidth = FULL_WIDTH_ROUTES.has(pathname);

  return (
    <>
      {!collapsed && <AdminNav />}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2.5 border-b px-4">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Show sidebar" : "Hide sidebar"}
            title={collapsed ? "Show sidebar" : "Hide sidebar"}
            className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeft className="size-4" />
          </button>
          {Icon && <Icon className={cn("size-4 shrink-0", current.color)} />}
          <span className="truncate text-sm font-semibold">{current?.label ?? "Admin"}</span>
        </div>
        {fullWidth ? (
          <main className="min-h-0 flex-1 overflow-y-auto p-6">{children}</main>
        ) : (
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-5xl p-8">{children}</div>
          </main>
        )}
      </div>
    </>
  );
}
