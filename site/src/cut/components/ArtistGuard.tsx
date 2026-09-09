"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Clapperboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreatorApplicationDialog } from "@/cut/components/CreatorApplicationDialog";
import { signInUrl } from "@/cut/lib/generate";
import { authClient } from "@/lib/auth-client";
import { useAccount } from "@/queries/credits";

// Gates Inspiration, My Submissions, and Submit Project — every surface that
// only makes sense once someone is a DepArtist. Payouts is broader (see
// PayoutsGuard: any earning program grants it, not just this one). Unlike
// AdminGuard, a non-artist isn't hiding anything shady: they land on a page
// that offers the same "Apply to be creator" flow the account menu does,
// since Artist is a program anyone can ask to join.
export function ArtistGuard({ children }: { children: ReactNode }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const account = useAccount();
  const [applyOpen, setApplyOpen] = useState(false);

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

  if (!account.data?.isArtist) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-8 py-20 text-center">
        <Clapperboard className="size-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Artist access required</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          This is for approved artists. Apply and we&apos;ll review it.
        </p>
        <Button className="mt-5" onClick={() => setApplyOpen(true)}>
          Apply to be creator
        </Button>
        {applyOpen && <CreatorApplicationDialog onClose={() => setApplyOpen(false)} />}
      </div>
    );
  }

  return <>{children}</>;
}
