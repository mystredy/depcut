"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { attemptChunkReloadOnce, hasAttemptedChunkReload, isChunkLoadError } from "@/lib/chunkLoadError";
import { reportSiteError } from "@/lib/reportSiteError";

// Root-level Next.js error boundary — catches a render crash anywhere that
// has no more specific error.tsx of its own (see cut/app/(home)/error.tsx
// for the editor's own boundary), so a bug never just goes to a blank page.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chunkError = isChunkLoadError(error);
  // A pure read, captured once on first render, so the very first paint
  // already shows "loading" instead of flashing the crash screen before
  // the effect below kicks off the actual reload.
  const [reloading] = useState(() => chunkError && !hasAttemptedChunkReload());

  useEffect(() => {
    // A stale chunk reference (this build redeployed since the page — or a
    // share link — loaded) isn't a real crash; reset() can't fix it since
    // it doesn't re-fetch anything, so try a real reload first and only
    // report it if that reload lands back on the same error.
    if (chunkError && attemptChunkReloadOnce()) return;
    reportSiteError("render crash: root", error);
  }, [error, chunkError]);

  if (reloading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Loading the latest version…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-medium text-red-600 dark:text-red-400">Something went wrong</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {chunkError
          ? "A new version of DepCut is available."
          : error.message || "An unexpected error occurred."}
      </p>
      {error.digest && <p className="text-[11px] text-muted-foreground">Error ID: {error.digest}</p>}
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={chunkError ? () => window.location.reload() : reset}
      >
        {chunkError ? "Reload" : "Try again"}
      </Button>
    </div>
  );
}
