"use client";

import { useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type AdminCreatorApplication,
  useAdminCreatorApplications,
  useReviewCreatorApplication,
} from "@/queries/admin";

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Every "Apply to be creator" submission from the account menu's dialog
// (POST /api/creator-applications/me). Approving upserts a
// CreatorRateAccount so the new creator can earn and cash out right away.
export default function AdminCreatorApplicationsPage() {
  const applications = useAdminCreatorApplications();
  const pending = (applications.data?.applications ?? []).filter((a) => a.status === "Pending");
  const reviewed = (applications.data?.applications ?? []).filter((a) => a.status !== "Pending");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Clapperboard className="size-5 text-muted-foreground" /> Creator Applications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Requests to become a paid Rates creator, filed from the account menu.
        </p>
      </div>

      {applications.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : applications.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load applications. Try again.</p>
      ) : applications.data?.applications.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          No applications yet.
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              {pending.map((a) => (
                <ApplicationCard key={a.userId} application={a} />
              ))}
            </div>
          )}
          {reviewed.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reviewed ({reviewed.length})
              </p>
              {reviewed.map((a) => (
                <ApplicationCard key={a.userId} application={a} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApplicationCard({ application }: { application: AdminCreatorApplication }) {
  const review = useReviewCreatorApplication();
  const [note, setNote] = useState("");

  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold">{application.applicantName}</span>
          <span className="text-xs text-muted-foreground">{application.applicantEmail}</span>
          <StatusBadge status={application.status} />
        </div>
        <span className="text-xs text-muted-foreground">{timeAgo(application.createdAt)}</span>
      </div>

      <p className="rounded-lg border bg-muted/20 p-2.5 text-xs whitespace-pre-wrap">{application.reason}</p>

      {application.portfolio && (
        <a
          href={application.portfolio}
          target="_blank"
          rel="noreferrer"
          className="block w-fit text-xs text-primary underline underline-offset-2"
        >
          {application.portfolio}
        </a>
      )}

      {application.status === "Pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note to applicant (optional)…"
            className="max-w-xs flex-1 rounded-lg border bg-transparent px-2.5 py-1 text-xs outline-none focus-visible:border-ring"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={review.isPending}
            onClick={() => review.mutate({ reviewNote: note.trim() || undefined, status: "Rejected", userId: application.userId })}
          >
            Reject
          </Button>
          <Button
            size="sm"
            disabled={review.isPending}
            onClick={() => review.mutate({ reviewNote: note.trim() || undefined, status: "Approved", userId: application.userId })}
          >
            {review.isPending ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
            Approve
          </Button>
        </div>
      ) : (
        application.reviewNote && (
          <p
            className={cn(
              "rounded-lg border p-2.5 text-xs",
              application.status === "Approved"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-red-500/10 text-red-700 dark:text-red-400",
            )}
          >
            {application.reviewNote}
          </p>
        )
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: AdminCreatorApplication["status"] }) {
  const styles: Record<AdminCreatorApplication["status"], string> = {
    Approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    Pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    Rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  };
  return (
    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", styles[status])}>
      {status}
    </span>
  );
}
