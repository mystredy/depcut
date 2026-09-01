"use client";

import { useHydrationSafeSession } from "@/lib/auth-client";

// AuthScreen's post-auth fallback when no callbackURL rides the query string.
// Targets equal to it need no param, keeping the common auth URLs clean.
const DEFAULT_APP_TARGET = "/app";

// The auth screens live at root-level /sign-in and /sign-up on the auth-owning
// host (donkeycut.com owns auth directly) and read callbackURL in either mode.
// The app target (already root-prefixed for the host) rides along as the
// post-auth callback.
export function authHrefFor(
  page: "/sign-in" | "/sign-up",
  appTarget: string,
): string {
  return appTarget === DEFAULT_APP_TARGET
    ? page
    : `${page}?callbackURL=${encodeURIComponent(appTarget)}`;
}

// Where a landing CTA should actually go: straight into the app when signed in,
// or to sign-in when signed out. During the initial (pending) client render the
// session is unknown, matching the static server HTML, so CTAs render the app
// target first and swap to the sign-in link once a signed-out session resolves.
// useHydrationSafeSession (not the raw authClient.useSession) is what makes
// that first render trustworthy — see its own doc comment for why the raw
// hook can already disagree with the server by the time this even mounts.
export function useAppEntryHref(): (appTarget: string) => string {
  const { data: session, isPending } = useHydrationSafeSession();
  return (appTarget: string) =>
    isPending || session ? appTarget : authHrefFor("/sign-in", appTarget);
}
