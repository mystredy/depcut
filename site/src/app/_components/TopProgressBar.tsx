"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Phase = "idle" | "loading" | "done";

// The brand gradient (violet -> blue -> pink), inlined rather than imported
// from cut/_components/landing/dark/theme — that file is scoped to the Cut
// landing page only, and this bar mounts globally in the root layout.
const GRADIENT = "linear-gradient(90deg, #8B5CF6, #3B82F6 55%, #EC4899)";

const GROW_DELAY_MS = 120;
const FADE_DELAY_MS = 150;
const FADE_DURATION_MS = 250;

// Clicking something that's about to do real work (a cold server render, a
// full-page reload through one of the auth/proxy passthrough routes, a
// settings-menu item that navigates via router.push with no <a> in sight)
// gave no feedback until the destination painted — a slow click looked like
// a dead one. This starts a thin top bar the instant that happens, and
// finishes it the moment the route actually changes.
//
// Two independent triggers, since no single browser or Next.js API covers
// both real navigations this app makes:
//  - A document-level click listener catches <a> elements — both next/link's
//    client-side navigation and the plain <a> full-page reloads some routes
//    still need (see CutTopNav's isAuthPassthroughHref). Both render as a
//    real <a> in the DOM.
//  - Patching router.push/router.replace on the shared AppRouterInstance
//    (the same object every useRouter() call in the app receives from
//    context) catches programmatic navigation with no <a> involved at all —
//    e.g. NavUser's dropdown menu items (Billing, Usage, Studio…), which
//    navigate from a DropdownMenuItem's onClick. This has to be the router
//    object's own methods, not history.pushState/replaceState: Next defers
//    the actual pushState call until the destination is ready to render, so
//    for a slow navigation patching history fires at the same moment the
//    navigation finishes, too late to show anything. router.push() itself
//    still runs synchronously at click time regardless of how slow the
//    navigation ends up being.
export function TopProgressBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navKey = `${pathname}?${searchParams.toString()}`;

  const [phase, setPhase] = useState<Phase>("idle");
  const [wide, setWide] = useState(false);
  const [prevNavKey, setPrevNavKey] = useState(navKey);

  // Navigation committed (the route changed since the last render) —
  // resolve any in-flight bar. Setting state directly in the render body,
  // guarded by comparing against the previous value (also state, not a
  // ref — this codebase's lint rules disallow reading/writing refs during
  // render), is React's documented pattern for adjusting state in response
  // to a changed value without routing it through an effect.
  if (prevNavKey !== navKey) {
    setPrevNavKey(navKey);
    if (phase !== "idle") setPhase("done");
  }

  const start = useCallback(() => {
    setWide(false);
    setPhase("loading");
  }, []);

  // While loading, bump the bar from its initial burst to a slower crawl —
  // a run that's still going after GROW_DELAY_MS is a real load, not just
  // click latency. Re-running start() while already "loading" is a no-op
  // state update, so this timer isn't restarted by a second click on the
  // same in-flight navigation — the effect's own cleanup cancels it if the
  // phase moves on to "done" first.
  useEffect(() => {
    if (phase !== "loading") return undefined;
    const t = setTimeout(() => setWide(true), GROW_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Once "done", snap to full width, hold briefly, then fade out and reset
  // to idle so the next click starts from a clean bar.
  useEffect(() => {
    if (phase !== "done") return undefined;
    const t = setTimeout(() => {
      setPhase("idle");
      setWide(false);
    }, FADE_DELAY_MS + FADE_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // No e.defaultPrevented check: next/link calls preventDefault() on its
      // own click handling before this listener ever sees the event (React's
      // root listener fires during bubble before it reaches document), and
      // that's exactly the client-side navigation this needs to catch.
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // External origin: this tab isn't the one that's about to load.
      if (url.origin !== window.location.origin) return;
      // Same path + query: a hash-only jump (e.g. "#pricing"), not a navigation.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [start]);

  useEffect(() => {
    const originalPush = router.push.bind(router);
    const originalReplace = router.replace.bind(router);

    // Mutates the shared AppRouterInstance in place (wrap on mount, restore
    // on cleanup) rather than replacing router.push at its call sites —
    // there's no other way to observe a router.push() call itself, and every
    // component's own useRouter() call resolves to this exact same object.
    // eslint-disable-next-line react-hooks/immutability -- intentional: temporary wrap + restore, not a lingering mutation
    router.push = (...args: Parameters<typeof router.push>) => {
      start();
      return originalPush(...args);
    };
    router.replace = (...args: Parameters<typeof router.replace>) => {
      start();
      return originalReplace(...args);
    };

    return () => {
      router.push = originalPush;
      router.replace = originalReplace;
    };
  }, [router, start]);

  if (phase === "idle") return null;

  const width = phase === "done" ? 100 : wide ? 72 : 20;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 3,
        width: `${width}%`,
        background: GRADIENT,
        boxShadow: "0 0 8px rgba(139,92,246,0.6)",
        zIndex: 2147483647,
        opacity: phase === "done" ? 0 : 1,
        transition:
          phase === "done"
            ? `width 200ms ease-out, opacity ${FADE_DURATION_MS}ms ease-in ${FADE_DELAY_MS}ms`
            : "width 400ms ease-out",
        pointerEvents: "none",
      }}
    />
  );
}
