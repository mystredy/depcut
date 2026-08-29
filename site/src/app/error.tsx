"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
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
  useEffect(() => {
    reportSiteError("render crash: root", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
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
