"use client";

import { useState } from "react";
import { CheckCircle2, Clapperboard, Clock, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { type AdminSubmission, useAdminSubmissions, useReviewSubmission } from "@/queries/admin";

const STATUS_STYLE: Record<string, string> = {
  Pending: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  InReview: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Qualified: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Disqualified: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

// Submissions started from the editor's Submit button (Submission.projectId
// set) instead of a manual video/thumbnail upload. Review happens against
// the live project, not an uploaded file — there's no in-page preview here
// yet (that needs an admin-scoped project read, since projects.ts's
// getProject is scoped to the owning creator's userId), only the project's
// name and the usual approve/reject/score actions Creator Submissions uses.
export default function ProjectSubmissionsPage() {
  const submissions = useAdminSubmissions();
  const items = (submissions.data?.submissions ?? []).filter((s) => s.projectId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Project Submission</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submissions sent straight from the editor, linked to their source project instead of an
          uploaded video and thumbnail.
        </p>
      </div>

      {submissions.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : submissions.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load submissions. Try again.</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No project submissions yet.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ProjectSubmissionCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectSubmissionCard({ item }: { item: AdminSubmission }) {
  const review = useReviewSubmission();
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [score, setScore] = useState(8);
  const [remark, setRemark] = useState("");

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 md:flex-row">
      <div className="flex w-full shrink-0 flex-col items-center justify-center gap-2 rounded-xl border bg-muted/30 p-6 text-center md:w-56">
        <Clapperboard className="size-6 text-muted-foreground" />
        <p className="truncate text-xs font-medium">{item.project?.name ?? "Untitled project"}</p>
      </div>

      <div className="flex flex-1 flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">{item.title || "Untitled submission"}</h3>
              <p className="text-xs text-muted-foreground">
                {item.submitterName} · {item.submitterEmail}
                {item.category && ` · ${item.category.emoji} ${item.category.name}`}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                STATUS_STYLE[item.reviewStatus ?? ""] ?? "border-border text-muted-foreground"
              )}
            >
              {item.reviewStatus ?? "Unreviewed"}
            </span>
          </div>
          {item.voiceScript && (
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
              <Clock /> Start review
            </Button>
          </div>
        ) : item.reviewStatus === "InReview" ? (
          decision ? (
            <div className="space-y-2 rounded-xl border p-3">
              {decision === "approve" && (
                <label className="flex items-center gap-2 text-xs">
                  Quality score (1–10)
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                    className="w-16 rounded-md border px-2 py-1"
                  />
                </label>
              )}
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Remark (optional)"
                rows={2}
                className="w-full rounded-md border px-2 py-1.5 text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDecision(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={review.isPending}
                  onClick={() => {
                    const trimmedRemark = remark.trim() || undefined;
                    if (decision === "approve") {
                      review.mutate({ action: "approve", id: item.id, reviewScore: score, remark: trimmedRemark });
                    } else {
                      review.mutate({ action: "reject", id: item.id, remark: trimmedRemark });
                    }
                  }}
                >
                  Confirm {decision === "approve" ? "approval" : "rejection"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDecision("reject")}>
                <XCircle /> Reject
              </Button>
              <Button size="sm" onClick={() => setDecision("approve")}>
                <CheckCircle2 /> Approve
              </Button>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
