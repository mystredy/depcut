"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Clock,
  Download,
  Film,
  Layers,
  Loader2,
  Scaling,
  SlidersHorizontal,
  Sparkles,
  VideoIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { MediaGenerationHistory } from "@/cut/components/MediaGenerationHistory";
import { AddRefButton, MentionTextarea, RefChips } from "@/cut/components/AssetRefs";
import {
  COUNT_OPTIONS,
  DURATION_OPTIONS,
  IconSelect,
  OMNI_BEST_EFFORT_NOTE,
  REF_MODE_OPTIONS,
  RESOLUTION_OPTIONS,
  SegRow,
} from "@/cut/components/VideoGenControls";
import { useSelectableModels } from "@/cut/lib/aiModelAvailability";
import { addRefOnce, type AssetRef, collectRefs, useRefCandidates } from "@/cut/lib/assetRef";
import { bytesFromBase64 } from "@/cut/lib/bytes";
import { creditsUrl, NO_CREDITS_MESSAGE, promptAndImages, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { hostedPost } from "@/cut/lib/hosted";
import { refsToInlineImages, videoSafeInline, visualRefs, type InlineImage } from "@/cut/lib/refMedia";
import type { VideoRefMode } from "@/cut/lib/videoGen";
import {
  VIDEO_ASPECT_LABEL,
  VIDEO_MODELS,
  type VideoAspect,
  type VideoResolution,
  type VideoTier,
} from "@/cut/lib/videoModels";
import { persistVisualGeneration } from "@/cut/lib/visualGenerationPersist";
import { cn } from "@/lib/utils";

// The client-facing shape of a GET /api/visual-generations row.
type VisualHistoryRow = {
  id: string;
  prompt: string;
  status: string;
  errorMessage: string | null;
  outputUrl: string | null;
  outputMime: string | null;
  createdAt: string;
};

const COUNTS = [1, 2, 3, 4] as const;
// Mirrors generate.ts's own video poll loop (see finishVideo) — this
// composer runs its own, since that one is wired into the project job store
// this has none of (no project exists yet when it's used from the dashboard,
// and the standalone Text to Video page never creates one at all).
const REFRESH_MS = 8000;
const VIDEO_DEADLINE_MS = 12 * 60_000;

async function readError(res: Response, fallback: string): Promise<string> {
  if (res.status === 401) return "Sign in to DepCut to generate videos.";
  if (res.status === 402) return NO_CREDITS_MESSAGE;
  const body = (await res.json().catch(() => null)) as {
    error?: unknown;
    message?: unknown;
    details?: { message?: unknown } | null;
  } | null;
  const message = [body?.message, body?.error].find(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const detail =
    typeof body?.details?.message === "string" && body.details.message.trim()
      ? body.details.message.trim()
      : null;
  if (detail && detail !== message) return message ? `${message} ${detail}` : detail;
  return message ?? fallback;
}

const providerError = (error: unknown): string | null => {
  if (typeof error === "string" && error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return null;
};

type GenerationOutput = { dataBase64?: string; url?: string; contentType?: string };
type GenerationResponse = {
  id: string;
  status: "in_progress" | "completed" | "failed";
  provider: string;
  model: string;
  providerJobId: string | null;
  providerGenerationId: string | null;
  providerPollingUrl: string | null;
  outputs: GenerationOutput[];
  error?: unknown;
  metadata?: Record<string, unknown>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A local file, or a picked Library/stock asset, staged as a reference —
 * never imported into a project (nothing here has one): resolved straight to
 * inline bytes fetched from its ref url. */
function refFromLocalFile(file: File): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name: file.name,
    kind: file.type.startsWith("video") ? "video" : "image",
    url: URL.createObjectURL(file),
  };
}

/** A freshly generated clip staged as a reference for the next render — video
 * refs resolve to a captured frame (see refMedia.ts), so this rides the same
 * path as any other visual reference. */
function refFromVideoBlob(blob: Blob, name: string): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name,
    kind: "video",
    url: URL.createObjectURL(blob),
  };
}

// The shared video-generation composer behind both the standalone Text to
// Video page and the dashboard's own generate box: the same hosted video
// models (kind: "video" on /api/inference/assets), with no project involved
// — a render comes back as a plain downloadable/playable file shown right
// here, and nothing about generating navigates anywhere. Video renders async
// (the model can take a while), so this polls /api/inference/assets/refresh
// itself rather than reaching into generate.ts's project-scoped job store.
export function VideoGenerator({ className }: { className?: string }) {
  const signedIn = useSignedIn();
  const signedOut = signedIn === false;

  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [refs, setRefs] = useState<AssetRef[]>([]);
  const [refMode, setRefModeState] = useState<VideoRefMode>("ingredients");
  const [aspect, setAspect] = useState<VideoAspect>("16:9");
  const [tier, setTier] = useState<VideoTier>("omni");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [count, setCount] = useState<(typeof COUNTS)[number]>(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [results, setResults] = useState<{ url: string; blob: Blob }[]>([]);
  const queryClient = useQueryClient();

  const setRefMode = (mode: VideoRefMode) => {
    setRefModeState(mode);
    setRefs([]);
  };

  // No project here, so only the account-wide Library and the bundled stock
  // catalog are referenceable — never a "Media" or "Timeline" group.
  const candidates = useRefCandidates().filter((c) => c.scope === "library" || c.scope === "stock");
  const addRef = (ref: AssetRef) => setRefs((prev) => addRefOnce(prev, ref));

  useEffect(() => {
    return () => {
      for (const r of results) URL.revokeObjectURL(r.url);
    };
  }, [results]);

  // Narrowed to whatever an admin has actually left enabled
  // (/admin/settings/ai-models); falls back to the full list while that
  // loads or if nothing's enabled, so the picker is never empty.
  const selectableModels = useSelectableModels("video", VIDEO_MODELS);
  const model = selectableModels.find((m) => m.tier === tier) ?? selectableModels[0];
  const resolutionOptions = RESOLUTION_OPTIONS[model.provider] ?? RESOLUTION_OPTIONS["gemini-omni"];
  const durationOptions = DURATION_OPTIONS[model.provider] ?? DURATION_OPTIONS["gemini-omni"];
  const effResolution = resolutionOptions.some((o) => o.value === resolution)
    ? resolution
    : resolutionOptions[0].value;
  const effDurationSeconds = durationOptions.some((o) => o.value === durationSeconds)
    ? durationSeconds
    : durationOptions[durationOptions.length - 1].value;
  const aspectOptions = model.aspects.map((a) => ({ value: a, label: VIDEO_ASPECT_LABEL[a].split(" ")[0] }));
  const effAspect = model.aspects.includes(aspect) ? aspect : model.aspects[0];
  const acceptsReferences = model.maxReferenceImages > 0;
  const refModeOption = REF_MODE_OPTIONS.find((o) => o.value === refMode) ?? REF_MODE_OPTIONS[0];

  // A model switch that drops reference support clears any staged refs
  // rather than leave an attachment the next request would just ignore.
  // Adjusted during render, per React's own guidance for state that tracks
  // a derived value: https://react.dev/learn/you-might-not-need-an-effect
  const [prevAcceptsReferences, setPrevAcceptsReferences] = useState(acceptsReferences);
  if (prevAcceptsReferences !== acceptsReferences) {
    setPrevAcceptsReferences(acceptsReferences);
    if (!acceptsReferences) setRefs([]);
  }

  const generateOne = async (
    text: string,
    inputs: { images?: InlineImage[]; referenceImages?: InlineImage[] } | undefined
  ): Promise<{ url: string; blob: Blob }> => {
    const res = await hostedPost("/api/inference/assets", {
      kind: "video",
      prompt: text,
      provider: model.provider,
      model: model.modelId,
      ...(inputs ? { inputs } : {}),
      parameters: { aspectRatio: effAspect, resolution: effResolution, durationSeconds: effDurationSeconds },
    });
    if (!res.ok) throw new Error(await readError(res, "Video generation failed."));
    let gen = (await res.json()) as GenerationResponse;

    const deadline = Date.now() + VIDEO_DEADLINE_MS;
    while (gen.status === "in_progress") {
      if (Date.now() > deadline) throw new Error("The video render is taking too long — try again.");
      await sleep(REFRESH_MS);
      const poll = await hostedPost("/api/inference/assets/refresh", {
        id: gen.id,
        kind: "video",
        provider: gen.provider,
        model: gen.model,
        providerJobId: gen.providerJobId,
        providerGenerationId: gen.providerGenerationId,
        providerPollingUrl: gen.providerPollingUrl,
        metadata: gen.metadata ?? {},
      });
      if (!poll.ok) throw new Error(await readError(poll, "Video generation failed."));
      gen = (await poll.json()) as GenerationResponse;
    }
    if (gen.status !== "completed") {
      throw new Error(providerError(gen.error) ?? "Video generation failed.");
    }
    const out = gen.outputs.find((o) => o.dataBase64) ?? gen.outputs.find((o) => o.url);
    let blob: Blob;
    if (out?.dataBase64) {
      blob = new Blob([bytesFromBase64(out.dataBase64)], { type: out.contentType ?? "video/mp4" });
    } else if (out?.url) {
      const dl = await fetch(out.url);
      if (!dl.ok) throw new Error("Could not download the generated video.");
      blob = new Blob([await dl.arrayBuffer()], { type: out.contentType ?? "video/mp4" });
    } else {
      throw new Error("The provider returned no video.");
    }
    return { url: URL.createObjectURL(blob), blob };
  };

  const generate = async () => {
    const { text, refs: allRefs } = collectRefs(prompt.trim(), refs, candidates);
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      let sentPrompt = text;
      let inputs: { images?: InlineImage[]; referenceImages?: InlineImage[] } | undefined;
      if (allRefs.length > 0) {
        if (refMode === "ingredients") {
          // Identity anchors: the prompt rides as written, no compose rewrite.
          const anchors = await Promise.all(
            (await refsToInlineImages(visualRefs(allRefs).slice(0, model.maxReferenceImages))).map(
              videoSafeInline
            )
          );
          if (anchors.length > 0) inputs = { referenceImages: anchors };
        } else {
          // A single seed frame — the model has no use for more than one.
          const { prompt: sent, images: rawImages } = await promptAndImages("video", text, allRefs, true, 1);
          sentPrompt = sent;
          const images = await Promise.all(rawImages.map(videoSafeInline));
          if (images.length > 0) inputs = { images };
        }
      }
      const settled = await Promise.allSettled(
        Array.from({ length: count }, () => generateOne(sentPrompt, inputs))
      );
      const ok = settled.filter(
        (s): s is PromiseFulfilledResult<{ url: string; blob: Blob }> => s.status === "fulfilled"
      );
      const failed = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
      if (ok.length > 0) setResults(ok.map((s) => s.value));
      for (const s of ok) {
        await persistVisualGeneration({
          aspect: effAspect,
          blob: s.value.blob,
          durationSeconds: effDurationSeconds,
          prompt: text,
          status: "succeeded",
          tier,
        });
      }
      if (failed.length > 0) {
        const first = failed[0].reason;
        const message = first instanceof Error ? first.message : "Video generation failed.";
        setError({
          text: ok.length > 0 ? `${failed.length} of ${count} failed: ${message}` : message,
          credits: message === NO_CREDITS_MESSAGE,
        });
        await persistVisualGeneration({
          aspect: effAspect,
          errorMessage: message,
          prompt: text,
          status: "failed",
          tier,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["visual-generations"] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Video generation failed.";
      setError({ text: message, credits: message === NO_CREDITS_MESSAGE });
      await persistVisualGeneration({
        aspect: effAspect,
        errorMessage: message,
        prompt: text,
        status: "failed",
        tier,
      });
      void queryClient.invalidateQueries({ queryKey: ["visual-generations"] });
    } finally {
      setBusy(false);
    }
  };

  /** Attach a generated clip (just made, or pulled back out of history) as a
   * reference for the next generation. */
  const attachAsReference = (blob: Blob, name: string) => addRef(refFromVideoBlob(blob, name));

  const attachHistoryEntryAsReference = async (row: VisualHistoryRow) => {
    if (!row.outputUrl) return;
    const blob = await fetch(row.outputUrl).then((r) => r.blob());
    attachAsReference(blob, row.prompt.slice(0, 60) || "reference");
  };

  return (
    <div className={cn("space-y-5", className)}>
      <div className="relative flex flex-col rounded-2xl border border-input bg-card focus-within:border-ring">
        <RefChips
          refs={refs}
          onRemove={(r) => setRefs((prev) => prev.filter((x) => !(x.scope === r.scope && x.id === r.id)))}
          className="p-2.5 pb-0"
          thumbClassName="size-12"
        />
        <MentionTextarea
          className="min-h-[100px] w-full resize-y bg-transparent px-3.5 py-3 text-[13px] leading-relaxed outline-none"
          placeholder="What do you want to create?"
          value={prompt}
          onChange={setPrompt}
          candidates={candidates}
          submitKey="mod-enter"
          menuSide="bottom"
          onSubmit={() => void generate()}
          attachedRefs={refs}
          uploadFile={(file) => Promise.resolve(refFromLocalFile(file))}
          inputRef={promptRef}
        />

        <div className="flex flex-col gap-2 px-3 pb-3">
          {settingsOpen && (
            <div className="flex flex-col gap-3 rounded-xl border border-input bg-muted/30 p-3">
              {selectableModels.length > 1 && (
                <SegRow
                  title="Model"
                  value={tier}
                  onChange={setTier}
                  options={selectableModels.map((m) => ({ value: m.tier, label: m.model }))}
                />
              )}
              {acceptsReferences && (
                <SegRow
                  title="How references are used"
                  value={refMode}
                  onChange={setRefMode}
                  options={REF_MODE_OPTIONS}
                />
              )}
              <SegRow title="Aspect ratio" value={effAspect} onChange={setAspect} options={aspectOptions} />
              <SegRow title="Resolution" value={effResolution} onChange={setResolution} options={resolutionOptions} />
              <div className="h-px shrink-0 bg-border" />
              <SegRow
                title="Duration"
                value={effDurationSeconds}
                onChange={setDurationSeconds}
                options={durationOptions}
              />
              {model.provider === "gemini-omni" && (
                <p className="px-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                  {OMNI_BEST_EFFORT_NOTE}
                </p>
              )}
              <SegRow title="Number of takes" value={count} onChange={setCount} options={COUNT_OPTIONS} />
            </div>
          )}
          <div className="flex items-center justify-between gap-1">
            <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
              <button
                type="button"
                title="More settings"
                aria-label="More settings"
                aria-pressed={settingsOpen}
                onClick={() => setSettingsOpen((v) => !v)}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full transition-colors",
                  settingsOpen
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <SlidersHorizontal className="size-4" />
              </button>
              <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />
              {acceptsReferences && (
                <AddRefButton
                  onPick={addRef}
                  onUploadFiles={(files) => {
                    for (const file of files) addRef(refFromLocalFile(file));
                  }}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  inputRef={promptRef}
                  accept="image/*,video/*"
                />
              )}
              <IconSelect
                icon={Film}
                title="Model"
                value={tier}
                display={model.model}
                options={selectableModels.map((m) => ({ value: m.tier, label: m.model }))}
                onChange={setTier}
              />
              <IconSelect
                icon={Sparkles}
                title="Resolution"
                value={effResolution}
                display={effResolution}
                options={resolutionOptions}
                onChange={setResolution}
              />
              {acceptsReferences && (
                <IconSelect
                  icon={refModeOption.icon}
                  title="How references are used"
                  value={refMode}
                  display={refModeOption.label}
                  options={REF_MODE_OPTIONS}
                  onChange={setRefMode}
                />
              )}
              <IconSelect
                icon={Layers}
                title="Number of takes"
                value={count}
                display={`x${count}`}
                options={COUNT_OPTIONS}
                onChange={setCount}
              />
              <IconSelect
                icon={Clock}
                title="Duration"
                value={effDurationSeconds}
                display={`${effDurationSeconds}s`}
                options={durationOptions}
                onChange={setDurationSeconds}
              />
              <IconSelect
                icon={Scaling}
                title="Aspect ratio"
                value={effAspect}
                display={effAspect}
                options={aspectOptions}
                onChange={setAspect}
              />
            </div>
            <button
              type="button"
              title="Generate video"
              aria-label="Generate video"
              disabled={!prompt.trim() || signedOut || busy}
              onClick={() => void generate()}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
            </button>
          </div>
        </div>
      </div>

      {signedOut ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Generating runs on your DepCut account.{" "}
          <a className="font-medium text-blue-600 hover:underline dark:text-blue-400" href={signInUrl()}>
            Sign in
          </a>{" "}
          to continue.
        </p>
      ) : (
        error && (
          <p className="text-[11px] leading-relaxed text-red-600">
            {error.text}
            {error.credits && (
              <>
                {" "}
                <a
                  className="font-medium underline hover:no-underline"
                  href={creditsUrl()}
                  target="_blank"
                  rel="noreferrer"
                >
                  Add credits
                </a>
              </>
            )}
          </p>
        )
      )}

      {busy && (
        <p className="flex items-center gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <Loader2 className="size-3.5 shrink-0 animate-spin" /> Rendering — this can take a few minutes.
        </p>
      )}

      {results.length > 0 && (
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <SectionTitle>Result</SectionTitle>
          <div className={cn("grid gap-2", results.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {results.map((r, i) => (
              <div key={r.url} className="group relative overflow-hidden rounded-lg">
                <video src={r.url} controls playsInline className="w-full rounded-lg" />
                <div className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <button
                    type="button"
                    title="Use as reference"
                    onClick={() => attachAsReference(r.blob, prompt.slice(0, 60) || `text-to-video-${i + 1}`)}
                    className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <VideoIcon className="size-3" />
                  </button>
                  <a
                    href={r.url}
                    download={`text-to-video-${i + 1}.mp4`}
                    title="Download"
                    className="grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Download className="size-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!signedOut && (
        <MediaGenerationHistory<VisualHistoryRow>
          basePath="visual-generations"
          listKey="generations"
          kind="video"
          label={(row) => row.prompt}
          emptyMessage="Nothing saved to your account yet — a generated clip will show up here."
          onUseAsReference={(row) => void attachHistoryEntryAsReference(row)}
        />
      )}
    </div>
  );
}
