"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportSiteError } from "@/lib/reportSiteError";

// Catches a render crash inside the app's own pages while HomeLayout's
// sidebar and header — the surrounding shell — stay mounted and usable, so
// a bug in one page doesn't strand the user on a blank screen with no way
// back.
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportSiteError("render crash: app", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-medium text-red-600 dark:text-red-400">Something went wrong</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      {error.digest && <p className="text-[11px] text-muted-foreground">Error ID: {error.digest}</p>}
      <Button size="sm" variant="outline" className="mt-2" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
