"use client";

import { TopNav } from "@/app/_components/landing/TopNav";
import { authHrefFor } from "@/app/_components/landing/useAppEntryHref";

// The depcut.com site nav: DepCut wordmark with session-aware auth
// entries. Shared by the Cut landing and the pass-through pages (e.g.
// /install).
export function CutTopNav() {
  return (
    <TopNav
      homeHref="/"
      wordmark="DepCut"
      signedInPill={{ href: "/app", label: "Go to App" }}
      signedOutAuth={{
        logInHref: authHrefFor("/sign-in", "/app"),
        signUpHref: authHrefFor("/sign-up", "/app"),
      }}
    />
  );
}
