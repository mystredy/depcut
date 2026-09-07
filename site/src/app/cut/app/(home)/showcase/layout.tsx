"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { useCutBase } from "@/cut/lib/nav";
import { useAccount } from "@/queries/credits";

// Showcase is being built out — superuser-only until there's a real public
// feed behind it worth shipping. Same client-gate pattern as su/layout.tsx:
// UX only, since the page itself calls no server route yet (its data is a
// local seed list — see page.tsx); add a withSuperUser-guarded route the
// moment this reads from anything real.
export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const base = useCutBase();
  const account = useAccount();
  const superUser = account.data?.superUser === true;

  useEffect(() => {
    if (account.isPending || superUser) return;
    router.replace(base);
  }, [account.isPending, superUser, router, base]);

  if (!superUser) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
