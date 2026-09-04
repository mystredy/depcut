"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, ClipboardCheck, Clock, FileText, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSiteDateFormat } from "@/lib/siteDateFormat";
import { cn } from "@/lib/utils";
import {
  type AdminSubmission,
  useAdminFinanceExchangeRate,
  useAdminSubmissions,
  useReviewSubmission,
} from "@/queries/admin";

type MainTab = "pending" | "my-reviews";
type ReviewSubTab = "in-review" | "approved" | "rejected";

function formatTabCount(count: number): string {
  return count > 9 ? "9+" : String(count);
}

export default function AdminSubmissionsPage() {
  return (
    <Suspense>
      <AdminSubmissionsContent />
    </Suspense>
  );
}

function AdminSubmissionsContent() {
  const submissions = useAdminSubmissions();
  const exchangeRate = useAdminFinanceExchangeRate();
  const [mainTab, setMainTab] = useState<MainTab>("pending");
  const [reviewSubTab, setReviewSubTab] = useState<ReviewSubTab>("in-review");

  // A Telegram "New Submission" notification links back to
  // /admin/submissions?id=... — land straight on the tab that submission
  // actually lives in and scroll it into view, instead of just opening the
  // default Pending list.
  const targetId = useSearchParams().get("id");
  const [highlightId, setHighlightId] = useState<string | null>(targetId);
  const landedRef = useRef(false);

  const all = submissions.data?.submissions ?? [];
  const pending = all.filter((s) => s.reviewStatus === "Pending" || !s.reviewStatus);
  const inReview = all.filter((s) => s.reviewStatus === "InReview");
  const approved = all.filter((s) => s.reviewStatus === "Qualified");
  const rejected = all.filter((s) => s.reviewStatus === "Disqualified");

  useEffect(() => {
    if (!targetId || landedRef.current) return;
    const target = all.find((s) => s.id === targetId);
    if (!target) return;
    landedRef.current = true;
    if (target.reviewStatus === "Qualified") {
      setMainTab("my-reviews");
      setReviewSubTab("approved");
    } else if (target.reviewStatus === "Disqualified") {
      setMainTab("my-reviews");
      setReviewSubTab("rejected");
    } else if (target.reviewStatus === "InReview") {
      setMainTab("my-reviews");
      setReviewSubTab("in-review");
    } else {
      setMainTab("pending");
    }
  }, [all, targetId]);

  const shown =
    mainTab === "pending"
      ? pending
      : reviewSubTab === "in-review"
        ? inReview
        : reviewSubTab === "approved"
          ? approved
          : rejected;

  const emptyLabel =
    mainTab === "pending"
      ? "pending"
      : reviewSubTab === "in-review"
        ? "in-review"
        : reviewSubTab === "approved"
          ? "approved"
          : "rejected";

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

      <div className="space-y-3 border-b pb-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMainTab("pending")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
              mainTab === "pending"
                ? "border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Clock className="size-3.5" />
            Pending Submissions ({formatTabCount(pending.length)})
          </button>
          <button
            type="button"
            onClick={() => setMainTab("my-reviews")}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-colors",
              mainTab === "my-reviews"
                ? "border-primary bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            <FileText className="size-3.5" />
            My Reviews ({formatTabCount(inReview.length)})
          </button>
        </div>

        {mainTab === "my-reviews" && (
          <div className="flex flex-wrap gap-2 border-t pt-3 pl-3">
            <button
              type="button"
              onClick={() => setReviewSubTab("in-review")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                reviewSubTab === "in-review"
                  ? "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Clock className="size-3.5" />
              In Review ({formatTabCount(inReview.length)})
            </button>
            <button
              type="button"
              onClick={() => setReviewSubTab("approved")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                reviewSubTab === "approved"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <CheckCircle2 className="size-3.5" />
              Approved
            </button>
            <button
              type="button"
              onClick={() => setReviewSubTab("rejected")}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                reviewSubTab === "rejected"
                  ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <XCircle className="size-3.5" />
              Rejected
            </button>
          </div>
        )}
      </div>

      {submissions.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : submissions.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load submissions. Try again.</p>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No {emptyLabel} submissions.
        </div>
      ) : (
        <div className="space-y-4">
          {shown.map((item) => (
            <SubmissionCard
              key={item.id}
              item={item}
              rate={rate}
              highlighted={item.id === highlightId}
              onSeenHighlight={() => setHighlightId(null)}
              onStartReview={() => {
                setMainTab("my-reviews");
                setReviewSubTab("in-review");
              }}
              onApprove={() => setReviewSubTab("approved")}
              onReject={() => setReviewSubTab("rejected")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({
  item,
  rate,
  highlighted,
  onSeenHighlight,
  onStartReview,
  onApprove,
  onReject,
}: {
  item: AdminSubmission;
  rate: number;
  highlighted: boolean;
  onSeenHighlight: () => void;
  onStartReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const review = useReviewSubmission();
  const { formatDateTime } = useSiteDateFormat();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [score, setScore] = useState(8);
  const [creatorSplit, setCreatorSplit] = useState(50);
  const [remark, setRemark] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  const maxRates = item.maxRates ?? 10;
  const previewEarned = Math.round((maxRates * score) / 10);

  useEffect(() => {
    if (!highlighted) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const timeout = setTimeout(onSeenHighlight, 3000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-shadow md:flex-row",
        highlighted && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
    >
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
              onClick={() => review.mutate({ action: "start-review", id: item.id }, { onSuccess: onStartReview })}
            >
              {review.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
              Start Review
            </Button>
          </div>
        ) : item.reviewStatus === "InReview" ? (
          <div className="space-y-3 border-t pt-3.5">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDecision("approve")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-wide transition-colors sm:flex-none",
                  decision === "approve"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <CheckCircle2 className="size-3.5" /> APPROVE
              </button>
              <button
                type="button"
                onClick={() => setDecision("reject")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-[10px] font-bold tracking-wide transition-colors sm:flex-none",
                  decision === "reject"
                    ? "border-red-500 bg-red-500/10 text-red-600 dark:text-red-400"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <XCircle className="size-3.5" /> REJECT
              </button>
            </div>

            {decision && (
              <div className="space-y-3 pt-1">
                {decision === "approve" && (
                  <div className="space-y-2">
                    <div className="space-y-1 rounded-lg border bg-muted/20 px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Quality evaluation
                        </label>
                        <span className="text-[11px] font-bold text-primary">
                          {score}/10 → {previewEarned} Rates
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={score}
                        onChange={(e) => setScore(Number(e.target.value))}
                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                      />
                    </div>

                    <div className="space-y-1 rounded-lg border bg-muted/20 px-2.5 py-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Work split
                        </label>
                        <span className="text-[11px] font-bold">
                          {creatorSplit}% C / {100 - creatorSplit}% P
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={creatorSplit}
                        onChange={(e) => setCreatorSplit(Number(e.target.value))}
                        className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                      />
                    </div>
                  </div>
                )}

                <div className="border-t pt-3">
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Reviewer remark {decision === "reject" && <span className="text-destructive">*</span>}
                  </label>
                  <textarea
                    rows={2}
                    value={remark}
                    onChange={(e) => setRemark(e.target.value)}
                    placeholder={
                      decision === "reject"
                        ? "Enter rejection reason here (required)…"
                        : "Enter approval feedback notes (optional)…"
                    }
                    className="w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-xs outline-none focus-visible:border-ring"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <Button size="sm" variant="ghost" onClick={() => setDecision(null)}>
                    Cancel
                  </Button>
                  {decision === "approve" ? (
                    <Button
                      size="sm"
                      disabled={review.isPending}
                      onClick={() =>
                        review.mutate(
                          {
                            action: "approve",
                            creatorWorkdone: creatorSplit,
                            id: item.id,
                            remark: remark.trim() || undefined,
                            reviewScore: score,
                          },
                          { onSuccess: onApprove }
                        )
                      }
                    >
                      {review.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                      ) : (
                        <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                      )}
                      Confirm Approval & Pay
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={review.isPending || !remark.trim()}
                      title={!remark.trim() ? "A rejection remark is required" : undefined}
                      onClick={() =>
                        review.mutate(
                          { action: "reject", id: item.id, remark: remark.trim() || undefined },
                          { onSuccess: onReject }
                        )
                      }
                    >
                      {review.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                      ) : (
                        <XCircle className="size-3.5" data-icon="inline-start" />
                      )}
                      Confirm Rejection
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2 border-t pt-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <ClipboardCheck className="size-3" /> Reviewer decision
            </p>
            <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/20 p-2.5 text-xs">
              <div>
                <p className="text-muted-foreground">Reviewed by</p>
                <p className="font-medium">{item.reviewedByName ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Reviewed at</p>
                <p className="font-medium">
                  {item.reviewedAt ? formatDateTime(item.reviewedAt) : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Earned</p>
                <p className="font-medium">
                  {item.earnedRates ?? 0} Rates{item.reviewScore ? ` (score ${item.reviewScore}/10)` : ""}
                </p>
              </div>
            </div>
            {item.statusRemark && (
              <div className="border-t pt-2 text-xs">
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
