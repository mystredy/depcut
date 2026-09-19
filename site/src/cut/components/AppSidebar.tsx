"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Shield, X } from "lucide-react";
import { ALL_GROUPS, ARTIST_GROUP, GROUPS, LINKS, type NavGroup } from "@/cut/lib/navData";
import { homeHref, useCutBase } from "@/cut/lib/nav";
import { useMobileSidebar } from "@/cut/lib/mobileSidebar";
import { useAccount } from "@/queries/credits";
import { BetaBadge } from "@/cut/components/BetaBadge";
import { SiteLogo } from "@/cut/components/SiteLogo";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const base = useCutBase();
  const account = useAccount();
  // Showcase is superuser-only while it's being built (see its layout's own
  // guard) — keep it out of the sidebar for everyone else so the link isn't
  // just a dead end.
  const visibleLinks = LINKS.filter((l) => l.tab !== "showcase" || account.data?.superUser === true);
  const { isMobile, open: mobileOpen, setOpen: setMobileOpen } = useMobileSidebar();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile is a fixed overlay with its own backdrop, not part of the page's
  // flex layout, so it can afford the full labelled panel — the icon-only
  // rail below is a desktop-only collapse state.
  const showRail = !isMobile && collapsed;
  const closeMobile = () => setMobileOpen(false);
  const closeOnMobile = () => {
    if (isMobile) closeMobile();
  };
  // AI suite and Editor start expanded — GROUPS is exactly those two, not
  // ARTIST_GROUP, which stays collapsed unless the current page is one of
  // its own children (same rule as before for every group).
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () =>
      new Set([
        ...GROUPS.map((g) => g.key),
        ...ALL_GROUPS.filter((g) => pathname.startsWith(`${base}/${g.key}/`)).map((g) => g.key),
      ])
  );

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Collapsed rail (desktop only): a group has no page of its own, so its
  // icon expands the sidebar back out and opens straight to its children.
  const openGroupExpanded = (key: string) => {
    setCollapsed(false);
    setOpenGroups((prev) => new Set(prev).add(key));
  };

  const railBtn =
    "grid size-10 shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground";

  // Rail group: no room for a label, so the icon un-collapses the sidebar
  // and opens this group instead of showing an inline expanding list.
  const renderRailGroup = ({ key, label, icon: Icon }: NavGroup) => (
    <button key={key} type="button" onClick={() => openGroupExpanded(key)} aria-label={label} title={label} className={railBtn}>
      <Icon className="size-4" />
    </button>
  );

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
        <div className="fixed inset-0 z-40 bg-black/50" onClick={closeMobile} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "dark border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          isMobile
            ? cn("fixed inset-y-0 left-0 z-50 w-60 shadow-xl", mobileOpen ? "translate-x-0" : "-translate-x-full")
            : cn("shrink-0 overflow-hidden", showRail ? "w-16" : "w-60")
        )}
      >
        {showRail ? (
          // Desktop only — mobile always renders the labelled panel below.
          <div className="flex h-full w-16 flex-col items-center gap-1 overflow-y-auto py-4">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="group relative mb-4 size-9 shrink-0 transition-transform hover:scale-105"
            >
              <SiteLogo width={36} height={36} compact className="transition-opacity group-hover:opacity-0" />
              <ChevronRight className="absolute inset-0 m-auto size-4 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100" />
            </button>
            {visibleLinks.map(({ tab, label, icon: Icon }) => {
              const href = homeHref(base, tab);
              const active = pathname === href;
              return (
                <Link
                  key={tab}
                  href={href}
                  aria-label={label}
                  title={label}
                  className={cn(railBtn, active && "bg-sidebar-accent text-sidebar-foreground")}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
            {GROUPS.map(renderRailGroup)}
            {account.data?.isArtist && (
              <div className="mt-4 border-t border-sidebar-border pt-4">{renderRailGroup(ARTIST_GROUP)}</div>
            )}
            {account.data?.superUser && (
              <Link href="/admin" aria-label="Admin" title="Admin" className={railBtn}>
                <Shield className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="flex h-full w-60 flex-col overflow-y-auto px-3 py-4">
            <div className="mb-5 flex items-center justify-between gap-2.5 px-2">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0">
                  <SiteLogo width={36} height={36} />
                  <span className="text-[24px] font-semibold tracking-tight">epCut</span>
                </span>
                <BetaBadge />
              </div>
              {isMobile ? (
                <button
                  type="button"
                  onClick={closeMobile}
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
              {visibleLinks.map(({ tab, label, icon: Icon }) => {
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
            {account.data?.isArtist && (
              <div className="mt-4 border-t border-sidebar-border pt-4">{renderGroup(ARTIST_GROUP)}</div>
            )}
            {account.data?.superUser && (
              <div className="mt-4 border-t border-sidebar-border pt-4">
                <Link
                  href="/admin"
                  onClick={closeOnMobile}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <Shield className="size-4" />
                  Admin
                </Link>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
