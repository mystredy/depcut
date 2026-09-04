"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, Download, Loader2, VideoIcon } from "lucide-react";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { ToolHistoryList } from "@/cut/components/ToolHistoryList";
import { AddRefButton, MentionTextarea, RefChips } from "@/cut/components/AssetRefs";
import {
  COUNT_OPTIONS,
  DURATION_OPTIONS,
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
import { useToolHistory } from "@/lib/toolHistory";
import { useBlobUrl } from "@/lib/useBlobUrl";
import { cn } from "@/lib/utils";

const COUNTS = [1, 2, 3, 4] as const;
// Mirrors generate.ts's own video poll loop (see finishVideo) — this page
// runs its own, since that one is wired into the project job store this
// page deliberately has none of.
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

/** What "Use again" needs to fully replay a past generation — every knob plus
 * the exact reference pictures sent, frozen as blobs so they survive the
 * originals changing or disappearing. */
type VideoGenInputs = {
  prompt: string;
  aspect: VideoAspect;
  tier: VideoTier;
  resolution: VideoResolution;
  durationSeconds: number;
  count: number;
  refMode: VideoRefMode;
  referenceImages: { name: string; blob: Blob }[];
};

/** A local file, or a picked Library/stock asset, staged as a reference —
 * never imported into a project (this page has none): resolved straight to
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

/** A still image blob staged as a reference — how a frozen history row's
 * reference pictures become attachments again on "Use again". */
function refFromImageBlob(blob: Blob, name: string): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name,
    kind: "image",
    url: URL.createObjectURL(blob),
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

function referenceImagesForHistory(images: InlineImage[]): { name: string; blob: Blob }[] {
  return images.map((img, i) => ({
    name: `Reference ${i + 1}`,
    blob: new Blob([bytesFromBase64(img.data)], { type: img.mimeType }),
  }));
}

// Standalone version of the editor Video tab's generate panel: the same
// hosted video models (kind: "video" on /api/inference/assets), minus the
// project — a render comes back as a plain downloadable file instead of
// landing as project media. Video renders async (the model can take a
// while), so this page polls /api/inference/assets/refresh itself rather
// than reaching into generate.ts's project-scoped job store.
export default function TextToVideoPage() {
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
  const history = useToolHistory("text-to-video");

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
    // Frozen once the refs resolve, reused for every history row this run
    // writes — the exact pictures sent, not just their live source.
    let referenceImages: { name: string; blob: Blob }[] = [];
    const baseInputs = (): VideoGenInputs => ({
      prompt: text,
      aspect: effAspect,
      tier,
      resolution: effResolution,
      durationSeconds: effDurationSeconds,
      count,
      refMode,
      referenceImages,
    });
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
      referenceImages = referenceImagesForHistory(inputs?.images ?? inputs?.referenceImages ?? []);
      const settled = await Promise.allSettled(
        Array.from({ length: count }, () => generateOne(sentPrompt, inputs))
      );
      const ok = settled.filter(
        (s): s is PromiseFulfilledResult<{ url: string; blob: Blob }> => s.status === "fulfilled"
      );
      const failed = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
      if (ok.length > 0) setResults(ok.map((s) => s.value));
      for (const s of ok) {
        history.save({
          inputs: baseInputs(),
          result: {
            blob: s.value.blob,
            filename: "text-to-video.mp4",
            kind: "blob",
            mimeType: s.value.blob.type || "video/mp4",
          },
          status: "succeeded",
          summary: text.slice(0, 80),
        });
      }
      if (failed.length > 0) {
        const first = failed[0].reason;
        const message = first instanceof Error ? first.message : "Video generation failed.";
        setError({
          text: ok.length > 0 ? `${failed.length} of ${count} failed: ${message}` : message,
          credits: message === NO_CREDITS_MESSAGE,
        });
        history.save({
          errorMessage: message,
          inputs: baseInputs(),
          status: "failed",
          summary: text.slice(0, 80),
        });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Video generation failed.";
      setError({ text: message, credits: message === NO_CREDITS_MESSAGE });
      history.save({
        errorMessage: message,
        inputs: baseInputs(),
        status: "failed",
        summary: text.slice(0, 80),
      });
    } finally {
      setBusy(false);
    }
  };

  const reuse = (inputs: Record<string, unknown>) => {
    if (typeof inputs.prompt === "string") setPrompt(inputs.prompt);
    if (typeof inputs.aspect === "string") setAspect(inputs.aspect as VideoAspect);
    if (typeof inputs.tier === "string" && VIDEO_MODELS.some((m) => m.tier === inputs.tier)) {
      setTier(inputs.tier as VideoTier);
    }
    if (typeof inputs.resolution === "string") setResolution(inputs.resolution as VideoResolution);
    if (typeof inputs.durationSeconds === "number") setDurationSeconds(inputs.durationSeconds);
    if (typeof inputs.count === "number" && (COUNTS as readonly number[]).includes(inputs.count)) {
      setCount(inputs.count as (typeof COUNTS)[number]);
    }
    if (inputs.refMode === "frames" || inputs.refMode === "ingredients") {
      setRefModeState(inputs.refMode);
    }
    // Older rows saved before references were tracked have no this field —
    // leave whatever's currently attached alone rather than clearing it.
    if (Array.isArray(inputs.referenceImages)) {
      setRefs(
        (inputs.referenceImages as { name: string; blob: Blob }[])
          .filter((r) => r?.blob instanceof Blob)
          .map((r) => refFromImageBlob(r.blob, r.name))
      );
    }
  };

  /** Attach a generated clip (just made, or pulled back out of history) as a
   * reference for the next generation. */
  const attachAsReference = (blob: Blob, name: string) => addRef(refFromVideoBlob(blob, name));

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold">Text to Video</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe a clip and DepCut&apos;s AI model will render it.
        </p>
      </div>

      <div className="space-y-5">
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
            <div className="flex items-center justify-between gap-2">
              {acceptsReferences ? (
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
              ) : (
                <span />
              )}
              <div className="flex min-w-0 items-center gap-1.5">
                <button
                  type="button"
                  title="Generation settings"
                  aria-label="Generation settings"
                  aria-pressed={settingsOpen}
                  onClick={() => setSettingsOpen((v) => !v)}
                  className={cn(
                    "flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                    settingsOpen
                      ? "border-ring bg-muted text-foreground"
                      : "border-input text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="truncate">{model.model}</span>
                  {effResolution}
                  {count > 1 && <span>x{count}</span>}
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
                <button
                  type="button"
                  title="Generate video"
                  aria-label="Generate video"
                  disabled={!prompt.trim() || signedOut || busy}
                  onClick={() => void generate()}
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                </button>
              </div>
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
      </div>

      <ToolHistoryList
        tool="text-to-video"
        onReuse={reuse}
        renderPreview={(entry) =>
          entry.result.kind === "blob" ? (
            <VideoHistoryPreview blob={entry.result.blob} />
          ) : null
        }
        onUseAsReference={(entry) =>
          entry.result.kind === "blob" && attachAsReference(entry.result.blob, entry.summary)
        }
      />
    </div>
  );
}

function VideoHistoryPreview({ blob }: { blob: Blob }) {
  const url = useBlobUrl(blob);
  if (!url) return null;
  return <video src={url} controls playsInline className="w-full rounded-lg" />;
}
