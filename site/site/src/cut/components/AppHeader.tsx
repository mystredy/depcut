"use client";

import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { NavNotifications } from "@/cut/components/NavNotifications";
import { NavUser } from "@/cut/components/NavUser";
import { useCutBase } from "@/cut/lib/nav";
import { pageTitleForPath } from "@/cut/lib/navData";
import { useMobileSidebar } from "@/cut/lib/mobileSidebar";

export function AppHeader() {
  const pathname = usePathname();
  const base = useCutBase();
  const title = pageTitleForPath(pathname, base);
  const { setOpen } = useMobileSidebar();

  return (
    <header className="dark sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-sidebar px-6 py-3 text-sidebar-foreground">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground md:hidden"
        >
          <Menu className="size-4.5" />
        </button>
        <span className="rounded-lg border border-sidebar-border bg-sidebar-accent px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <NavNotifications />
        <NavUser />
      </div>
    </header>
  );
}
