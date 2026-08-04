"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DonkeyLogoBadge } from "@/cut/components/DonkeyLogoBadge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { seedNewProjectDoc } from "@/cut/lib/docCache";
import { ALL_GROUPS, CREATOR_HUB_GROUP, GROUPS, LINKS, type NavGroup } from "@/cut/lib/navData";
import { homeHref, useCutBase } from "@/cut/lib/nav";
import { useMobileSidebar } from "@/cut/lib/mobileSidebar";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const base = useCutBase();
  const { isMobile, open: mobileOpen, setOpen: setMobileOpen } = useMobileSidebar();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile is show/hide, not shrink/expand — the icon rail only makes sense
  // when the sidebar stays on screen taking real layout width.
  const showRail = collapsed && !isMobile;
  const closeOnMobile = () => {
    if (isMobile) setMobileOpen(false);
  };
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(ALL_GROUPS.filter((g) => pathname.startsWith(`${base}/${g.key}/`)).map((g) => g.key))
  );

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Collapsed rail: a group has no page of its own, so its icon expands the
  // sidebar and opens straight to its children instead of navigating.
  const openGroupExpanded = (key: string) => {
    setCollapsed(false);
    setOpenGroups((prev) => new Set(prev).add(key));
  };

  const renderGroup = ({ key, label, icon: Icon, children }: NavGroup) => {
    const open = openGroups.has(key);
    return (
      <div key={key}>
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <span className="flex items-center gap-2.5">
            <Icon className="size-4" />
            {label}
          </span>
          <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        </button>
        {open && (
          <div className="ml-4 mt-0.5 flex flex-col gap-0.5 border-l border-sidebar-border pl-3.5">
            {children.map(({ slug, label: childLabel, icon: ChildIcon, href: childHref }) => {
              const href = childHref ?? `${base}/${key}/${slug}`;
              const active = pathname === href;
              return (
                <Link
                  key={slug}
                  href={href}
                  onClick={closeOnMobile}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent text-sidebar-foreground"
                  )}
                >
                  <ChildIcon className="size-3.5 shrink-0" />
                  {childLabel}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "dark border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-60 shadow-xl",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )
            : cn("shrink-0 overflow-hidden", showRail ? "w-16" : "w-60")
        )}
      >
        {showRail ? (
          <div className="flex h-full w-16 flex-col items-center gap-1 py-4">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group relative mb-4 size-9 shrink-0 transition-transform hover:scale-105"
            >
              <DonkeyLogoBadge className="size-9 text-sm transition-opacity group-hover:opacity-0" />
              <ChevronRight className="absolute inset-0 m-auto size-4 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            {LINKS.map(({ tab, label, icon: Icon }) => {
              const href = homeHref(base, tab);
              const active = pathname === href;
              return (
                <Link
                  key={tab}
                  href={href}
                  title={label}
                  className={cn(
                    "grid size-10 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    active && "bg-sidebar-accent text-sidebar-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
            {GROUPS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => openGroupExpanded(key)}
                title={label}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <Icon className="size-4" />
              </button>
            ))}
            <div className="mt-4 border-t border-sidebar-border pt-4">
              <button
                type="button"
                onClick={() => openGroupExpanded(CREATOR_HUB_GROUP.key)}
                title={CREATOR_HUB_GROUP.label}
                className="grid size-10 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              >
                <CREATOR_HUB_GROUP.icon className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-60 flex-col px-3 py-4">
            <div className="mb-5 flex items-center justify-between gap-2.5 px-2">
              <div className="flex items-center gap-2.5">
                <DonkeyLogoBadge className="size-9 text-sm" />
                <span className="text-[17px] font-semibold tracking-tight">Donkey Cut</span>
              </div>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  title="Close menu"
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
                >
                  <X className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="grid size-8 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
                >
                  <ChevronRight className="size-4 rotate-180" />
                </button>
              )}
            </div>

            <nav className="flex flex-col gap-0.5">
              {LINKS.map(({ tab, label, icon: Icon }) => {
                const href = homeHref(base, tab);
                const active = pathname === href;
                return (
                  <Link
                    key={tab}
                    href={href}
                    onClick={closeOnMobile}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
                      active && "bg-sidebar-accent text-sidebar-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                );
              })}
              {GROUPS.map(renderGroup)}
            </nav>
            <div className="mt-4 border-t border-sidebar-border pt-4">{renderGroup(CREATOR_HUB_GROUP)}</div>
          </div>
        )}
      </aside>
    </>
  );
}
