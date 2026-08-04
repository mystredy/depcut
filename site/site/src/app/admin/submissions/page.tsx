"use client";

import { useState } from "react";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type AdminSubmission,
  useAdminFinanceExchangeRate,
  useAdminSubmissions,
  useReviewSubmission,
} from "@/queries/admin";

type Filter = "pending" | "approved" | "rejected";

export default function AdminSubmissionsPage() {
  const submissions = useAdminSubmissions();
  const exchangeRate = useAdminFinanceExchangeRate();
  const [filter, setFilter] = useState<Filter>("pending");

  const all = submissions.data?.submissions ?? [];
  const pending = all.filter((s) => s.reviewStatus === "Pending" || s.reviewStatus === "InReview");
  const approved = all.filter((s) => s.reviewStatus === "Qualified");
  const rejected = all.filter((s) => s.reviewStatus === "Disqualified");
  const shown = filter === "pending" ? pending : filter === "approved" ? approved : rejected;
  const rate = exchangeRate.data?.exchangeRate.currentRate ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Creator Submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review clip submissions from Submit Project. Approving sets earned Rates from the
          assigned quality score and the linked task&apos;s (or submission&apos;s) max Rates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b pb-4">
        {(
          [
            { key: "pending" as const, label: "Pending", count: pending.length, icon: Clock },
            { key: "approved" as const, label: "Approved", count: approved.length, icon: CheckCircle2 },
            { key: "rejected" as const, label: "Rejected", count: rejected.length, icon: XCircle },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
              filter === tab.key
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {submissions.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : submissions.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load submissions. Try again.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No {filter} submissions.
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((item) => (
            <SubmissionCard key={item.id} item={item} rate={rate} />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ item, rate }: { item: AdminSubmission; rate: number }) {
  const review = useReviewSubmission();
  const [score, setScore] = useState(8);
  const [remark, setRemark] = useState("");

  const maxRates = item.maxRates ?? 10;
  const previewEarned = Math.round((maxRates * score) / 10);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row">
      <div className="flex w-full shrink-0 flex-col justify-between rounded-xl border bg-black p-3 text-white md:w-64">
        {item.hasVideo ? (
          <video
            src={`/api/submissions/${item.id}/video`}
            controls
            muted
            className="mb-2 aspect-video w-full rounded-lg bg-black object-contain"
          />
        ) : (
          <div className="mb-2 flex aspect-video w-full items-center justify-center rounded-lg bg-white/5 text-xs text-white/50">
            No video attached
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wide text-emerald-400">Potential Payout</p>
          <p className="text-lg font-bold">
            {maxRates} Rates
            {rate > 0 && (
              <span className="ml-1 text-xs font-normal text-white/60">
                (≈ ${(maxRates * rate).toFixed(2)})
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              {item.task && (
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {item.task.title}
                </p>
              )}
              <h3 className="text-base font-semibold">{item.title}</h3>
              <p className="text-xs text-muted-foreground">
                {item.submitterName} · {item.submitterEmail}
                {item.category && ` · ${item.category.emoji} ${item.category.name}`}
              </p>
            </div>
            <StatusBadge status={item.reviewStatus} />
          </div>

          {item.voiceScript && item.reviewStatus !== "Qualified" && item.reviewStatus !== "Disqualified" && (
            <p className="rounded-lg border bg-muted/30 p-3 text-xs italic text-muted-foreground line-clamp-3">
              &quot;{item.voiceScript}&quot;
            </p>
          )}
        </div>

        {item.reviewStatus === "Pending" ? (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={review.isPending}
              onClick={() => review.mutate({ action: "start-review", id: item.id })}
            >
              {review.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Start Review
            </Button>
          </div>
        ) : item.reviewStatus === "InReview" ? (
          <div className="space-y-3 rounded-xl border bg-muted/20 p-3.5">
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Quality score: <span className="text-primary">{score}/10</span> → {previewEarned} Rates
              </p>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    className={cn(
                      "size-7 rounded-lg text-xs font-bold transition-colors",
                      score === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <input
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Reviewer remark (optional)"
              className="w-full rounded-lg border bg-transparent px-3 py-1.5 text-xs outline-none focus-visible:border-ring"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={review.isPending}
                onClick={() => review.mutate({ action: "reject", id: item.id, remark: remark.trim() || undefined })}
              >
                <XCircle className="size-3.5" data-icon="inline-start" /> Reject
              </Button>
              <Button
                size="sm"
                disabled={review.isPending}
                onClick={() =>
                  review.mutate({
                    action: "approve",
                    id: item.id,
                    remark: remark.trim() || undefined,
                    reviewScore: score,
                  })
                }
              >
                {review.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                Approve & Pay
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/20 p-3.5 text-xs">
            <div>
              <p className="text-muted-foreground">Reviewed by</p>
              <p className="font-medium">{item.reviewedByName ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Earned</p>
              <p className="font-medium">
                {item.earnedRates ?? 0} Rates{item.reviewScore ? ` (score ${item.reviewScore}/10)` : ""}
              </p>
            </div>
            {item.statusRemark && (
              <div className="col-span-2">
                <p className="text-muted-foreground">Remark</p>
                <p className="italic">&quot;{item.statusRemark}&quot;</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const styles: Record<string, string> = {
    Disqualified: "bg-red-500/10 text-red-600 dark:text-red-400",
    InReview: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    Pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    Qualified: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  };
  const label = status ?? "Pending";
  return (
    <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", styles[label])}>
      {label}
    </span>
  );
}
