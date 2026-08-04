"use client";

import { type ReactNode, useEffect } from "react";
import { ShieldAlert } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { signInUrl } from "@/cut/lib/generate";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "@/queries/credits";

// Gates the whole /admin area: signed-out visitors go to sign-in (same as
// SettingsGuard); signed-in visitors who aren't super users see a plain
// "not authorized" state rather than being silently bounced somewhere else.
// The real enforcement lives server-side (every /api/admin/* route re-checks
// isDonkeySuperUser) — this only decides what renders.
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
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold">You don&apos;t have access to this page</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The admin panel is limited to super-user accounts.
          </p>
        </div>
        <a className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/app">
          Back to Donkey Cut
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
