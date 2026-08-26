"use client";

import { useState } from "react";
import type React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Shield, X } from "lucide-react";
import { ALL_GROUPS, CREATOR_HUB_GROUP, GROUPS, LINKS, type NavGroup } from "@/cut/lib/navData";
import { homeHref, useCutBase } from "@/cut/lib/nav";
import { useMobileSidebar } from "@/cut/lib/mobileSidebar";
import { useAccount } from "@/queries/credits";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const base = useCutBase();
  const account = useAccount();
  const { isMobile, open: mobileOpen, setOpen: setMobileOpen } = useMobileSidebar();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile always shows the narrow icon rail — there's no room for the
  // labelled panel on a phone-width screen, and the rail's own overlay
  // (show/hide) already does the job the desktop expand/collapse toggle does.
  const showRail = isMobile || collapsed;
  // The rail stays mounted (just translated off-screen) between opens, so a
  // flyout left open from a previous visit needs clearing here too — else it
  // would show at a stale position next time the rail opens.
  const [mobileFlyout, setMobileFlyout] = useState<{ key: string; top: number } | null>(null);
  const closeMobile = () => {
    setMobileOpen(false);
    setMobileFlyout(null);
  };
  const closeOnMobile = () => {
    if (isMobile) closeMobile();
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
  // sidebar and opens straight to its children instead of navigating. Mobile
  // has no expanded width to grow into, so its rail is permanent — the icon
  // instead pops the group's children as a flyout beside it. The flyout is
  // positioned fixed (not absolute, inside the rail's own scroll container)
  // so a scrolled rail never clips it.
  const openGroupExpanded = (key: string, e?: React.MouseEvent<HTMLButtonElement>) => {
    if (isMobile) {
      // Read the button's position now — by the time a state updater runs,
      // React has already cleared the synthetic event's fields.
      const top = e?.currentTarget.getBoundingClientRect().top ?? 0;
      setMobileFlyout((prev) => (prev?.key === key ? null : { key, top }));
      return;
    }
    setCollapsed(false);
    setOpenGroups((prev) => new Set(prev).add(key));
  };

  // Rail icon size steps down on mobile — a phone-width overlay has no room
  // for the desktop rail's 64px, so it sits closer to 50px with tighter gaps.
  const railBtn = cn(
    "grid shrink-0 place-items-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
    isMobile ? "size-9" : "size-10"
  );

  // Rail group: no room for a label, so the icon pops its children as a
  // fixed-position flyout (rendered separately, see below) instead of an
  // inline expanding list.
  const renderRailGroup = ({ key, label, icon: Icon }: NavGroup) => (
    <button
      key={key}
      type="button"
      onClick={(e) => openGroupExpanded(key, e)}
      aria-label={label}
      title={label}
      className={cn(railBtn, mobileFlyout?.key === key && "bg-sidebar-accent text-sidebar-foreground")}
    >
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

  const flyoutGroup = mobileFlyout && ALL_GROUPS.find((g) => g.key === mobileFlyout.key);

  return (
    <>
      {isMobile && mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={closeMobile} aria-hidden="true" />
      )}
      <aside
        className={cn(
          "dark border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 w-14 shadow-xl",
                mobileOpen ? "translate-x-0" : "-translate-x-full"
              )
            : cn("shrink-0 overflow-hidden", showRail ? "w-16" : "w-60")
        )}
      >
        {showRail ? (
          <div
            className={cn(
              "flex h-full flex-col items-center overflow-y-auto",
              isMobile ? "w-14 gap-0.5 py-3" : "w-16 gap-1 py-4"
            )}
          >
            {isMobile ? (
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close menu"
                title="Close menu"
                className="mb-3 grid size-9 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
              >
                <X className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="group relative mb-4 size-9 shrink-0 transition-transform hover:scale-105"
              >
                <img
                  src="/deepw-logo.svg"
                  alt="Depcut"
                  className="size-9 object-contain transition-opacity group-hover:opacity-0"
                />
                <ChevronRight className="absolute inset-0 m-auto size-4 text-sidebar-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            )}
            {LINKS.map(({ tab, label, icon: Icon }) => {
              const href = homeHref(base, tab);
              const active = pathname === href;
              return (
                <Link
                  key={tab}
                  href={href}
                  onClick={closeOnMobile}
                  aria-label={label}
                  title={label}
                  className={cn(
                    railBtn,
                    active && "bg-sidebar-accent text-sidebar-foreground"
                  )}
                >
                  <Icon className="size-4" />
                </Link>
              );
            })}
            {GROUPS.map(renderRailGroup)}
            <div className={cn("border-t border-sidebar-border", isMobile ? "mt-3 pt-3" : "mt-4 pt-4")}>
              {renderRailGroup(CREATOR_HUB_GROUP)}
            </div>
            {account.data?.superUser && (
              <Link
                href="/admin"
                onClick={closeOnMobile}
                aria-label="Admin"
                title="Admin"
                className={railBtn}
              >
                <Shield className="size-4" />
              </Link>
            )}
          </div>
        ) : (
          // Desktop only — mobile always renders the rail above.
          <div className="flex h-full w-60 flex-col px-3 py-4">
            <div className="mb-5 flex items-center justify-between gap-2.5 px-2">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center">
                  <img
                    src="/deepw-logo.svg"
                    alt="Depcut"
                    width={36}
                    height={36}
                    className="block h-full w-full object-contain"
                  />
                </span>
                <span className="text-[17px] font-semibold tracking-tight">Depcut</span>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="grid size-8 shrink-0 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70"
              >
                <ChevronRight className="size-4 rotate-180" />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5">
              {LINKS.map(({ tab, label, icon: Icon }) => {
                const href = homeHref(base, tab);
                const active = pathname === href;
                return (
                  <Link
                    key={tab}
                    href={href}
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
            {account.data?.superUser && (
              <div className="mt-4 border-t border-sidebar-border pt-4">
                <Link
                  href="/admin"
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
      {isMobile && flyoutGroup && mobileFlyout && (
        <div
          className="dark fixed z-[60] w-48 rounded-lg border border-sidebar-border bg-sidebar p-1.5 text-sidebar-foreground shadow-xl"
          style={{ top: mobileFlyout.top, left: 60 }}
        >
          {flyoutGroup.children.map(({ slug, label: childLabel, icon: ChildIcon, href: childHref }) => {
            const href = childHref ?? `${base}/${flyoutGroup.key}/${slug}`;
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
    </>
  );
}
