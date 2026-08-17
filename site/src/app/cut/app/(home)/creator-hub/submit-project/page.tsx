"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";

import { useCutBase } from "@/cut/lib/nav";
import { useCreateDraftSubmission } from "@/queries/submissions";

// "New Submit" entry points (My Submissions, Inspiration) create a draft
// directly and push straight to its /submit-project/{id}. This bare route
// is the fallback for anyone landing here another way (a stale bookmark, a
// direct link) — it does the same create-then-redirect on mount so there's
// no dead end.
export default function SubmitProjectLandingPage() {
  const router = useRouter();
  const base = useCutBase();
  const createDraft = useCreateDraftSubmission();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    createDraft.mutate(undefined, {
      onSuccess: (data) => {
        router.replace(`${base}/creator-hub/submit-project/${data.submission.id}`);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (createDraft.isError) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-2 p-16 text-center text-sm">
        <AlertTriangle className="size-5 text-destructive" />
        <p className="text-destructive">
          {createDraft.error instanceof Error ? createDraft.error.message : "Couldn't start a new submission."}
        </p>
        <Link href={`${base}/creator-hub/my-projects`} className="font-medium text-primary underline">
          Back to My Submissions
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl items-center justify-center gap-2 p-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      Setting up your submission…
    </div>
  );
}
