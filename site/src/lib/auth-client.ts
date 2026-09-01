"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/**
 * authClient.useSession() reads a nanostore through useSyncExternalStore,
 * passing the same getter as both the client and server snapshot — so on
 * the client it can resolve to the real, already-fetched session before
 * this component's first hydration paint even runs, while SSR (which never
 * gets to finish a real session fetch mid-render) always renders the
 * unresolved default. Every caller of the raw hook in this codebase is
 * written assuming "unresolved" renders the same thing SSR does, so this
 * holds that default (data: null, isPending: true) until a real client
 * mount is confirmed, then reveals the live value — otherwise a
 * client-only-resolved session is a straight hydration mismatch, not just a
 * flash, and React discards and rebuilds the whole subtree over it.
 */
export function useHydrationSafeSession(): ReturnType<typeof authClient.useSession> {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const live = authClient.useSession();
  return mounted
    ? live
    : { data: null, isPending: true, isRefetching: false, error: null, refetch: live.refetch };
}
