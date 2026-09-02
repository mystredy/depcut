"use client";

import { useState } from "react";
import { CheckCircle2, Clapperboard, Clock, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMyCreatorApplication, useSubmitCreatorApplication } from "@/queries/creatorApplication";

/** The "Apply to be creator" form from the account menu — why they want to
 * join plus an optional portfolio link, stored as a CreatorApplication row
 * and reviewed at /admin/finance/creator-applications. Shows status instead
 * of the form once an application already exists; a rejected one can be
 * resubmitted. */
export function CreatorApplicationDialog({ onClose }: { onClose: () => void }) {
  const application = useMyCreatorApplication();
  const submit = useSubmitCreatorApplication();
  const [reason, setReason] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const canSubmit = reason.trim().length > 0;
  const doSubmit = () => {
    if (!canSubmit || submit.isPending) return;
    submit.mutate(
      { portfolio: portfolio.trim() || undefined, reason: reason.trim() },
      { onSuccess: () => setJustSubmitted(true) },
    );
  };

  const existing = application.data?.application;
  const showForm = !application.isLoading && !justSubmitted && (!existing || existing.status === "Rejected");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="size-4.5" /> Apply to be creator
          </DialogTitle>
        </DialogHeader>

        {application.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : showForm ? (
          <>
            {existing?.status === "Rejected" && (
              <p className="text-sm text-muted-foreground">
                Your last application wasn&apos;t approved. You can apply again below.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Tell us why you want to join and we&apos;ll review it.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="creator-reason">Why do you want to join?</Label>
                <Textarea
                  id="creator-reason"
                  className="min-h-28"
                  value={reason}
                  maxLength={2000}
                  placeholder="What you make, and why you'd be a good fit"
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="creator-portfolio">Portfolio link (optional)</Label>
                <Input
                  id="creator-portfolio"
                  value={portfolio}
                  maxLength={500}
                  placeholder="A link to your work"
                  onChange={(e) => setPortfolio(e.target.value)}
                />
              </div>
            </div>
            {submit.isError && (
              <p className="text-sm text-red-600">
                {submit.error instanceof Error ? submit.error.message : "Could not send that. Try again."}
              </p>
            )}
            <DialogFooter className="mt-2">
              <Button className="w-full" disabled={!canSubmit || submit.isPending} onClick={doSubmit}>
                {submit.isPending && <Loader2 className="animate-spin" data-icon="inline-start" />}
                {submit.isPending ? "Sending…" : "Submit application"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <StatusView status={justSubmitted ? "Pending" : (existing?.status ?? "Pending")} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusView({
  status,
  onClose,
}: {
  status: "Pending" | "Approved" | "Rejected";
  onClose: () => void;
}) {
  const copy: Record<typeof status, { icon: typeof Clock; title: string; body: string }> = {
    Approved: {
      body: "You're a creator now. Check Payouts in your account menu to set up cashouts.",
      icon: CheckCircle2,
      title: "You're in",
    },
    Pending: {
      body: "We got your application and the team's been notified. We'll let you know once it's reviewed.",
      icon: Clock,
      title: "Application sent",
    },
    Rejected: {
      body: "Your application wasn't approved.",
      icon: XCircle,
      title: "Not approved",
    },
  };
  const { icon: Icon, title, body } = copy[status];
  return (
    <>
      <div className="flex items-start gap-2.5 text-sm">
        <Icon className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">{title}</p>
          <p className="mt-1 text-muted-foreground">{body}</p>
        </div>
      </div>
      <DialogFooter className="mt-2">
        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
