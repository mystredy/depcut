"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { applyExtendResult } from "@/cut/lib/aiTools";
import { signInUrl, useGenerate, useSignedIn } from "@/cut/lib/generate";
import { useEditor } from "@/cut/lib/store";
import type { MediaAsset, VideoClip } from "@/cut/lib/types";
import { extendCapableTiers } from "@/cut/lib/videoModels";
import { SegRow } from "./VideoGenControls";

// AI Extend's preview-before-apply flow: pick direction/duration/prompt from
// what the active model's VideoExtendCapabilities actually offers (never a
// free range that gets silently rounded), generate, preview the result
// on its own (nothing touches the timeline yet), then Apply (a ripple-safe
// insert, one undo step — see applyExtendResult in aiTools.ts) or Discard.
// Regenerate submits a fresh render without disturbing anything already
// applied, since nothing here is applied until the user clicks Apply.
export function AiExtendDialog({
  clip,
  asset,
  onClose,
}: {
  clip: VideoClip;
  asset: MediaAsset;
  onClose: () => void;
}) {
  const signedIn = useSignedIn();
  const tier = extendCapableTiers()[0];
  const caps = tier?.extend;
  const [direction, setDirection] = useState<"start" | "end">(caps?.directions[0] ?? "end");
  const [duration, setDuration] = useState<number>(caps?.durations?.[0] ?? 6);
  const [prompt, setPrompt] = useState("Continue naturally.");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const job = useGenerate((s) => (jobId ? s.jobs.find((j) => j.id === jobId) : undefined));
  const resultAsset = useEditor((s) =>
    job?.assetId ? s.assets.find((a) => a.id === job.assetId) : undefined
  );

  const generate = () => {
    setError(null);
    setApplyError(null);
    const projectId = useEditor.getState().projectId;
    if (!projectId || !tier) return;
    const result = useGenerate.getState().extendVideo({
      target: { projectId, sourceClipId: clip.id, sourceAssetId: asset.id },
      direction,
      duration,
      prompt: prompt.trim() || undefined,
      tier: tier.tier,
    });
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setJobId(result.jobId);
  };

  const apply = () => {
    if (!resultAsset) return;
    const outcome = applyExtendResult(resultAsset.id);
    if (!outcome.ok) {
      setApplyError(outcome.reason);
      return;
    }
    onClose();
  };

  if (!tier || !caps?.supported) {
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>AI Extend</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            No configured video model supports AI Extend right now.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const showForm = !job || job.status === "error";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>AI Extend</DialogTitle>
          <DialogDescription>
            Continue this clip with {tier.word} — its own picture alone, no other tracks or overlays.
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          <div className="space-y-3">
            {caps.directions.length > 1 && (
              <SegRow
                title="Direction"
                value={direction}
                onChange={setDirection}
                options={caps.directions.map((d) => ({ value: d, label: d === "end" ? "End" : "Start" }))}
              />
            )}
            {caps.durations && (
              <SegRow
                title="Duration"
                value={duration}
                onChange={setDuration}
                options={caps.durations.map((d) => ({ value: d, label: `${d}s` }))}
              />
            )}
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={2}
              placeholder="Continue naturally."
            />
            {(error || job?.error) && (
              <p className="text-xs text-destructive">{error ?? job?.error}</p>
            )}
            {signedIn === false && (
              <p className="text-[11px] text-muted-foreground">
                Generating runs on your DepCut account.{" "}
                <a
                  className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  href={signInUrl()}
                >
                  Sign in
                </a>{" "}
                to continue.
              </p>
            )}
          </div>
        ) : job.status === "running" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Rendering the continuation — this can take a
            minute or two. Keep editing; it&apos;ll be ready when you come back.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Preview — not on the timeline yet.</p>
            {resultAsset && <video src={resultAsset.url} controls className="w-full rounded-lg border" />}
            {applyError && <p className="text-xs text-destructive">{applyError}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {job?.status === "done" ? "Discard" : "Cancel"}
          </Button>
          {showForm ? (
            <Button disabled={signedIn === false} onClick={generate}>
              <Sparkles data-icon="inline-start" /> Generate
            </Button>
          ) : job.status === "done" ? (
            <>
              <Button variant="outline" onClick={generate}>
                Regenerate
              </Button>
              <Button onClick={apply}>Apply</Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
