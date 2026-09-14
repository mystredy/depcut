"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { authHrefFor } from "@/app/_components/landing/useAppEntryHref";
import { BORDER } from "@/app/cut/_components/landing/dark/theme";
import { GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { BetaBadge } from "@/cut/components/BetaBadge";
import { SiteLogo } from "@/cut/components/SiteLogo";
import { useHydrationSafeSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV_ICON_SIZE = 40;

// The dark landing's own nav: same auth logic as the shared cream TopNav
// (useHydrationSafeSession decides signed-in vs signed-out, authHrefFor
// carries the callback target), but styled for a dark, glassy header instead
// of reusing the shared component directly — DepCut Vision, the auth
// screens, and the legal pages still render that one on the cream system.
export function CutTopNav() {
  const { data: session } = useHydrationSafeSession();
  const isSignedIn = Boolean(session);

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full py-3 md:py-4">
      <div
        className={cn(
          "mx-auto flex w-full max-w-[1400px] items-center justify-between rounded-2xl px-5 py-2.5 transition-all duration-300 md:px-8",
        )}
        style={{
          border: `1px solid ${scrolled ? BORDER : "transparent"}`,
          background: scrolled ? "rgba(8,7,12,0.75)" : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          boxShadow: scrolled ? "0 18px 50px rgba(0,0,0,0.35)" : "none",
        }}
      >
        <Link href="/" aria-label="DepCut home" className="flex items-center gap-2 text-white no-underline">
          <div className="flex items-center justify-center overflow-hidden rounded-[10px]" style={{ width: NAV_ICON_SIZE, height: NAV_ICON_SIZE }}>
            <SiteLogo width={NAV_ICON_SIZE} height={NAV_ICON_SIZE} compact />
          </div>
          <span className="text-xl font-semibold">DepCut</span>
          <BetaBadge className="ml-1" />
        </Link>
        <div className="flex items-center gap-3 md:gap-4">
          {isSignedIn ? (
            <GradientButton href="/app" variant="ghost" size="sm">
              Go to App
            </GradientButton>
          ) : (
            <>
              <a
                href={authHrefFor("/sign-in", "/app")}
                className="hidden whitespace-nowrap text-sm font-semibold text-white/80 no-underline hover:text-white sm:inline"
              >
                Log in
              </a>
              <GradientButton href={authHrefFor("/sign-up", "/app")} variant="gradient" size="sm">
                Sign up
              </GradientButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
