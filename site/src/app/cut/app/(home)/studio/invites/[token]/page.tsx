"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCutBase } from "@/cut/lib/nav";
import { apiFetch } from "@/queries/apiClient";

type AcceptedStudio = { id: string; name: string; username: string };
type AcceptState =
  | { status: "pending" }
  | { status: "success"; studio: AcceptedStudio }
  | { status: "error"; message: string };

// Module-scope, not component state: SettingsGuard above this page remounts
// its children whenever the session store's isPending/data flips (a
// hydration-mismatch recovery, a background session refetch, React's dev-only
// double effect invoke) — each remount would otherwise re-fire this
// one-time accept call. Caching the in-flight/settled promise by token here
// means every mount, old or new, resolves against the same call instead of
// starting a fresh one, and a stale mount's request still lands correctly on
// whichever instance is actually on screen when it settles.
const acceptRequests = new Map<string, Promise<AcceptState>>();

function acceptInvite(token: string): Promise<AcceptState> {
  let request = acceptRequests.get(token);
  if (!request) {
    request = apiFetch<{ studio: AcceptedStudio }>(`/api/studio-invites/${token}/accept`, { method: "POST" })
      .then((data): AcceptState => ({ status: "success", studio: data.studio }))
      .catch((error: unknown): AcceptState => ({
        status: "error",
        message: error instanceof Error ? error.message : "Something went wrong.",
      }));
    acceptRequests.set(token, request);
  }
  return request;
}

// Landing page for the "Accept invite" link in a studio invite email.
export default function StudioInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const base = useCutBase();
  const [state, setState] = useState<AcceptState>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    acceptInvite(token).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-4 px-6 py-24 text-center">
      {state.status === "pending" && <Loader2 className="size-6 animate-spin text-muted-foreground" />}

      {state.status === "success" && (
        <>
          <CheckCircle2 className="size-8 text-emerald-500" />
          <p className="text-sm font-medium">
            You now manage <strong>{state.studio.name}</strong>.
          </p>
          <Button nativeButton={false} render={<Link href={`/@${state.studio.username}`} />}>
            Go to the studio
          </Button>
        </>
      )}

      {state.status === "error" && (
        <>
          <XCircle className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{state.message}</p>
          <Button variant="outline" nativeButton={false} render={<Link href={`${base}/studio`} />}>
            Go to Studios
          </Button>
        </>
      )}
    </div>
  );
}
