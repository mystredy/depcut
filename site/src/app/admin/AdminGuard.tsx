"use client";

import { type ReactNode, useEffect } from "react";
import { notFound } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { signInUrl } from "@/cut/lib/generate";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "@/queries/credits";

// Gates the whole /admin area: signed-out visitors go to sign-in (same as
// SettingsGuard); signed-in visitors who aren't super users get the site's
// ordinary 404 rather than a page that confirms /admin exists and is merely
// off-limits — with real users on the site, that distinction is worth
// hiding. The real enforcement lives server-side (every /api/admin/* route
// re-checks isDonkeySuperUser) — this only decides what renders.
export function AdminGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const account = useAccount();

  const signedOut = !sessionPending && !session;

  useEffect(() => {
    if (!signedOut) return;
    window.location.assign(signInUrl());
  }, [signedOut]);

  if (sessionPending || !session || account.isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (!account.data?.superUser) {
    notFound();
  }

  return <>{children}</>;
}
