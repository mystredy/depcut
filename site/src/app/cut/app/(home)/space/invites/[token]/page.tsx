"use client";

import { use, useEffect, useRef } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCutBase } from "@/cut/lib/nav";
import { useAcceptBrandSpaceInvite } from "@/queries/brandSpace";

// Landing page for the "Accept invite" link in a Brand Space invite email.
export default function BrandSpaceInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const base = useCutBase();
  const accept = useAcceptBrandSpaceInvite();
  // A ref, not state — the guard itself shouldn't trigger a render.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    accept.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accept once per token, not on every accept identity change
  }, [token]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-24 text-center">
      {accept.isPending && <Loader2 className="size-6 animate-spin text-muted-foreground" />}

      {accept.isSuccess && (
        <>
          <CheckCircle2 className="size-8 text-emerald-500" />
          <p className="text-sm font-medium">
            You now manage <strong>{accept.data.space.name}</strong>.
          </p>
          <Button nativeButton={false} render={<Link href={`${base}/space/brand/${accept.data.space.username}`} />}>
            Go to the space
          </Button>
        </>
      )}

      {accept.isError && (
        <>
          <XCircle className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{(accept.error as Error).message}</p>
          <Button variant="outline" nativeButton={false} render={<Link href={`${base}/space`} />}>
            Go to My Space
          </Button>
        </>
      )}
    </div>
  );
}
