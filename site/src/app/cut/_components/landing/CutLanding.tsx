"use client";

import { BG, TEXT } from "@/app/cut/_components/landing/dark/theme";
import { CutFeatures } from "@/app/cut/_components/landing/CutFeatures";
import { CutFinalCTA } from "@/app/cut/_components/landing/CutFinalCTA";
import { CutFooter } from "@/app/cut/_components/landing/CutFooter";
import { CutHero } from "@/app/cut/_components/landing/CutHero";
import { CutPricing } from "@/app/cut/_components/landing/CutPricing";
import { CutTopNav } from "@/app/cut/_components/landing/CutTopNav";
import { CutWorksWith } from "@/app/cut/_components/landing/CutWorksWith";

// The depcut.com marketing page, on the dark gradient-accented visual
// system (`cut/_components/landing/dark`) — separate from the cream system
// `_components/landing` still uses for DepCut Vision, auth, and legal pages.
// Every CTA into the app is gated on session (useAppEntryHref): signed-out
// clicks route to sign-in first. The nav mirrors this — a "Log in" link
// with a "Sign up" pill when signed out, "Go to App" when signed in.
export function CutLanding() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      {/* The root layout's own background (the cream system's default) is a
          page-level style `<main>` alone can't fully cover — an iOS Safari
          overscroll bounce past the top/bottom edge shows the real body
          background underneath. This page is the one place on the site
          that needs dark instead, so it sets `<body>` directly rather than
          touching the shared global theme every other route still uses.
          A plain style tag (not a JS effect) so it's part of the very
          first paint — no flash of the light background before hydration.
          overflow-x: hidden on html/body clips the hero/CTA glow divs, which
          are wider than the viewport by design so their blur doesn't show a
          hard edge — without this they widen the page's scrollable area and
          mobile browsers respond by rendering the whole page zoomed out. */}
      <style>{`html, body { background: ${BG}; overflow-x: hidden; }`}</style>
      <CutTopNav />
      <CutHero />
      <CutFeatures />
      <CutWorksWith />
      <CutPricing />
      <CutFinalCTA />
      <CutFooter />
    </main>
  );
}
