"use client";

import { ArrowUp, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAdminAiEngines, useUpdateAiEngine } from "@/queries/admin";

export default function AdminAiEnginesPage() {
  const engines = useAdminAiEngines();
  const update = useUpdateAiEngine();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Engines</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Routing priority order. No real router reads this yet — it&apos;s an admin-facing list,
          not live traffic control.
        </p>
      </div>

      {engines.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : engines.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load engines. Try again.</p>
      ) : (
        <div className="space-y-3">
          {engines.data?.engines.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4"
            >
              <div>
                <p className="text-sm font-semibold">{e.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {e.fallback && <>Fallback: {e.fallback}</>}
                  {e.fallback && e.latencyNote && " · "}
                  {e.latencyNote}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    update.mutate({ id: e.id, status: e.status === "active" ? "standby" : "active" })
                  }
                  className={cn(
                    "rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors",
                    e.status === "active"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  )}
                >
                  {e.status}
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ escalate: true, id: e.id })}
                >
                  <ArrowUp className="size-3.5" data-icon="inline-start" /> Escalate Priority
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
