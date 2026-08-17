"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminFinanceExchangeRate, useAdminTasks, useDeleteTask } from "@/queries/admin";

export default function AdminCampaignsListPage() {
  const tasks = useAdminTasks();
  const exchangeRate = useAdminFinanceExchangeRate();
  const del = useDeleteTask();

  const rate = exchangeRate.data?.exchangeRate.currentRate ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Active Campaigns Database ({tasks.data?.tasks.length ?? 0})
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live task campaigns posted to creators. Deleting one prevents artists from taking or
            submitting against it.
          </p>
        </div>
        <Link href="/admin/task-management/create" className={buttonVariants({ size: "sm" })}>
          <Plus className="size-3.5" data-icon="inline-start" /> New Campaign
        </Link>
      </div>

      {tasks.isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : tasks.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load campaigns. Try again.</p>
      ) : (
        <div className="space-y-3">
          {tasks.data?.tasks.map((t) => (
            <div key={t.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-primary">
                      {t.category.emoji} {t.category.name}
                    </span>
                    {t.niche && (
                      <span className="rounded bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-violet-600 dark:text-violet-400">
                        {t.niche}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm font-semibold">{t.title}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="rounded border bg-muted/40 px-2.5 py-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {t.maxRates} Rates (~${(t.maxRates * rate).toFixed(2)} USD)
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={del.isPending}
                    onClick={() => del.mutate(t.id)}
                    title="Delete campaign"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border bg-muted/20 p-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-4">
                <div>
                  <span className="block text-[9px] font-bold uppercase">Assigned To</span>
                  <span className="font-semibold text-foreground">
                    {t.requiredArtists.length > 0 ? `${t.requiredArtists.length} artist(s)` : "All Artists"}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold uppercase">Limit Deadline</span>
                  <span className="font-semibold text-foreground">{t.hoursToComplete ?? "—"} Hours</span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold uppercase">Status</span>
                  <span
                    className={`font-semibold ${
                      t.status === "available"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {t.status.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-bold uppercase">Bonus Share</span>
                  <span className="font-semibold text-foreground">
                    {t.additionalRevenueReward ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {tasks.data?.tasks.length === 0 && (
            <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
              No task campaigns yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
