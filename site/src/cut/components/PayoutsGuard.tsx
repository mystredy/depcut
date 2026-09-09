"use client";

import { type ReactNode, useEffect } from "react";
import { Wallet } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { signInUrl } from "@/cut/lib/generate";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "@/queries/credits";

// Payouts isn't owned by one program — DepArtist and Affiliate each grant
// payoutsEligible on their own (see /api/account/me), so this checks that
// instead of ArtistGuard's narrower isArtist. A visitor earning from neither
// yet just hasn't joined anything, so this points at both rather than
// picking one to push.
export function PayoutsGuard({ children }: { children: ReactNode }) {
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

  if (!account.data?.payoutsEligible) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-8 py-20 text-center">
        <Wallet className="size-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Nothing to pay out yet</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Payouts opens once you earn from DepArtist or the Affiliate program — join
          either from the account menu.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
