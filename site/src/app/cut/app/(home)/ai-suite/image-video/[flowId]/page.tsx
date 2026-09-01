"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  AtSign,
  ChevronDown,
  Clapperboard,
  Download,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Loader2,
  MoreVertical,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AddRefButton, FrameSlotButton, MentionTextarea, RefChips } from "@/cut/components/AssetRefs";
import {
  COUNT_OPTIONS,
  DURATION_OPTIONS,
  OMNI_BEST_EFFORT_NOTE,
  REF_MODE_OPTIONS,
  RESOLUTION_OPTIONS,
  SegRow,
} from "@/cut/components/VideoGenControls";
import { useSelectableModels } from "@/cut/lib/aiModelAvailability";
import { addRefOnce, insertRefToken, type AssetRef, collectRefs, useRefCandidates } from "@/cut/lib/assetRef";
import { creditsUrl, NO_CREDITS_MESSAGE, promptAndImages, signInUrl, useSignedIn } from "@/cut/lib/generate";
import { IMAGE_MODELS, type ImageTier } from "@/cut/lib/imageModels";
import { useCutBase } from "@/cut/lib/nav";
import { blobToInline, refsToInlineImages, videoSafeInline, visualRefs, type InlineImage } from "@/cut/lib/refMedia";
import type { VideoRefMode } from "@/cut/lib/videoGen";
import {
  VIDEO_ASPECT_LABEL,
  VIDEO_MODELS,
  type VideoAspect,
  type VideoResolution,
  type VideoTier,
} from "@/cut/lib/videoModels";
import {
  type CreateGenerationInput,
  type FlowGeneration,
  flowQueryKey,
  refreshGeneration,
  useCreateGeneration,
  useDeleteGeneration,
  useFlow,
  useSetFlowCover,
} from "@/queries/flows";
import { cn } from "@/lib/utils";

type Mode = "image" | "video";
type ImageAspect = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
const IMAGE_ASPECTS: ImageAspect[] = ["16:9", "4:3", "1:1", "3:4", "9:16"];
type CountValue = 1 | 2 | 3 | 4;
const POLL_MS = 8000;

function refFromLocalFile(file: File): AssetRef {
  return {
    scope: "file",
    id: crypto.randomUUID().slice(0, 8),
    name: file.name,
    kind: file.type.startsWith("video") ? "video" : "image",
    url: URL.createObjectURL(file),
  };
}

/** A completed generation's own output, staged as a reference for the next
 * one — "Use as reference," "Create video from this image," and an `@`
 * mention of it in the composer all funnel through this. The id is the
 * generation's own (not a fresh random one) so picking the same card twice
 * de-dupes via `sameRef` instead of adding a second copy. */
function refFromGeneration(g: FlowGeneration): AssetRef {
  return {
    scope: "file",
    id: g.id,
    name: g.prompt.slice(0, 60) || "Generated",
    kind: g.kind,
    url: g.outputUrl ?? "",
  };
}

// The Flow thread — a server-persisted creative thread mixing image and
// video generations (see prisma/GenerationFlows.prisma). Every result the
// account generated for this Flow shows in order; the composer at the
// bottom switches between Image and Video without leaving the thread.
export default function FlowThreadPage() {
  const { flowId } = useParams<{ flowId: string }>();
  const router = useRouter();
  const base = useCutBase();
  const signedIn = useSignedIn();
  const signedOut = signedIn === false;
  const queryClient = useQueryClient();

  const flow = useFlow(flowId);
  const createGeneration = useCreateGeneration(flowId);
  const deleteGeneration = useDeleteGeneration(flowId);
  const setCover = useSetFlowCover();
  const generations = flow.data?.generations ?? [];

  const [mode, setMode] = useState<Mode>("image");
  const [prompt, setPrompt] = useState("");
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [refs, setRefs] = useState<AssetRef[]>([]);
  const [refMode, setRefModeState] = useState<VideoRefMode>("ingredients");
  // Frames mode only: the render's closing frame, alongside the opening one
  // in refs[0] — a slot of its own rather than a second entry in refs, same
  // split the in-editor video panel (GeneratePanel/videoGen.ts) already uses.
  const [endFrame, setEndFrame] = useState<AssetRef | null>(null);
  const [imageTier, setImageTier] = useState<ImageTier>("pro");
  const [imageAspect, setImageAspect] = useState<ImageAspect>("16:9");
  const [videoTier, setVideoTier] = useState<VideoTier>("omni");
  const [videoAspect, setVideoAspect] = useState<VideoAspect>("16:9");
  const [resolution, setResolution] = useState<VideoResolution>("720p");
  const [durationSeconds, setDurationSeconds] = useState(8);
  const [count, setCount] = useState<CountValue>(1);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // OS files dropped straight onto the composer — a self-contained native
  // HTML5 drop handler rather than AssetRefs.tsx's useAssetDrop(onFiles):
  // that path is bridged by the main editor shell's own window-level drop
  // routing (Editor.tsx's fileZoneAt), which isn't mounted on this route, so
  // wiring it here would highlight the drop zone without ever delivering a
  // file.
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  // A ref, not just the busy state above: a fast double-fire (Enter plus a
  // click landing in the same tick, or a double-click) reads `busy` from the
  // same stale closure before React commits the first setBusy(true) — each
  // generation is a real, billed provider call, so a second submission
  // slipping through is a real double charge, not just a UI glitch. The ref
  // updates synchronously and closes that window; `busy` state stays purely
  // for the disabled/spinner UI.
  const busyRef = useRef(false);
  const [error, setError] = useState<{ text: string; credits?: boolean } | null>(null);
  const [infoOpenId, setInfoOpenId] = useState<string | null>(null);

  const setRefMode = (m: VideoRefMode) => {
    setRefModeState(m);
    setRefs([]);
    setEndFrame(null);
  };

  // Every `@`-mentionable reference for this composer: the account's library
  // and stock catalog, plus every completed image/video already generated in
  // THIS thread — the thing a user most naturally wants to reference in a
  // chat-style Flow ("make a video from @that last shot") isn't in a catalog
  // at all, it's a card two messages up.
  const libraryAndStockRefs = useRefCandidates().filter((c) => c.scope === "library" || c.scope === "stock");
  const candidates = useMemo(
    () => [
      ...generations.filter((g) => g.status === "completed" && g.outputUrl).map(refFromGeneration),
      ...libraryAndStockRefs,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- libraryAndStockRefs is a fresh array each render; its own source (the library fetch, the store) is what should trigger a recompute
    [generations, libraryAndStockRefs.length]
  );
  const addRef = (ref: AssetRef) => setRefs((prev) => addRefOnce(prev, ref));

  const selectableImageModels = useSelectableModels("image", IMAGE_MODELS);
  const imageModel = selectableImageModels.find((m) => m.tier === imageTier) ?? selectableImageModels[0];
  const selectableVideoModels = useSelectableModels("video", VIDEO_MODELS);
  const videoModel = selectableVideoModels.find((m) => m.tier === videoTier) ?? selectableVideoModels[0];
  const videoResolutionOptions = RESOLUTION_OPTIONS[videoModel.provider] ?? RESOLUTION_OPTIONS["gemini-omni"];
  const videoDurationOptions = DURATION_OPTIONS[videoModel.provider] ?? DURATION_OPTIONS["gemini-omni"];
  const effResolution = videoResolutionOptions.some((o) => o.value === resolution)
    ? resolution
    : videoResolutionOptions[0].value;
  const effDurationSeconds = videoDurationOptions.some((o) => o.value === durationSeconds)
    ? durationSeconds
    : videoDurationOptions[videoDurationOptions.length - 1].value;
  const videoAspectOptions = videoModel.aspects.map((a) => ({ value: a, label: VIDEO_ASPECT_LABEL[a].split(" ")[0] }));
  const effVideoAspect = videoModel.aspects.includes(videoAspect) ? videoAspect : videoModel.aspects[0];
  const acceptsReferences = mode === "video" ? videoModel.maxReferenceImages > 0 : true;

  // Poll every in-progress video on a timer, one flow-wide interval rather
  // than one per row — a completed poll invalidates the whole thread so the
  // finished card swaps in.
  const pendingIds = generations.filter((g) => g.status === "in_progress").map((g) => g.id);
  useEffect(() => {
    if (pendingIds.length === 0) return;
    const timer = setInterval(() => {
      void Promise.allSettled(pendingIds.map((id) => refreshGeneration(flowId, id))).then(() => {
        queryClient.invalidateQueries({ queryKey: flowQueryKey(flowId) });
      });
    }, POLL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-arms whenever the pending set changes, not on every render
  }, [flowId, pendingIds.join(",")]);

  const generateImage = async (text: string, allRefs: AssetRef[]) => {
    const { prompt: sent, images } = await promptAndImages("image", text, allRefs, true, Infinity);
    const inputs = images.length > 0 ? { images } : undefined;
    const base: Omit<CreateGenerationInput, "idempotencyKey"> = {
      kind: "image",
      prompt: sent,
      model: imageModel.modelId,
      tier: imageTier,
      ...(inputs ? { inputs } : {}),
      parameters: { aspectRatio: imageAspect, imageSize: "2K" },
    };
    // Each take is its own billed generation, so each gets its own key — one
    // key shared across the loop would make takes 2..N look like retries of
    // take 1 and be silently deduped away instead of actually rendered.
    for (let i = 0; i < count; i++) {
      await createGeneration.mutateAsync({ ...base, idempotencyKey: crypto.randomUUID() });
    }
  };

  const generateVideo = async (text: string, allRefs: AssetRef[]) => {
    let sentPrompt = text;
    let inputs: { images?: InlineImage[]; referenceImages?: InlineImage[]; lastFrame?: InlineImage[] } | undefined;
    if (refMode === "ingredients") {
      if (allRefs.length > 0) {
        const anchors = await Promise.all(
          (await refsToInlineImages(visualRefs(allRefs).slice(0, videoModel.maxReferenceImages))).map(videoSafeInline)
        );
        if (anchors.length > 0) inputs = { referenceImages: anchors };
      }
    } else {
      // Frames mode: refs[0] (the Start slot) opens the render, endFrame
      // closes it — resolved independently so "last frame only" (no Start)
      // works too, matching generate.ts's own lastFrame shape for the
      // in-editor video panel's Start/End slots.
      let images: InlineImage[] = [];
      if (allRefs.length > 0) {
        const { prompt: sent, images: rawImages } = await promptAndImages("video", text, allRefs, true, 1);
        sentPrompt = sent;
        images = await Promise.all(rawImages.map(videoSafeInline));
      }
      const [lastFrameImage] = endFrame
        ? await Promise.all((await refsToInlineImages(visualRefs([endFrame]))).map(videoSafeInline))
        : [];
      if (images.length > 0 || lastFrameImage) {
        inputs = {
          ...(images.length > 0 ? { images } : {}),
          ...(lastFrameImage ? { lastFrame: [lastFrameImage] } : {}),
        };
      }
    }
    const base: Omit<CreateGenerationInput, "idempotencyKey"> = {
      kind: "video",
      prompt: sentPrompt,
      provider: videoModel.provider,
      model: videoModel.modelId,
      tier: videoTier,
      refMode,
      ...(inputs ? { inputs } : {}),
      parameters: { aspectRatio: effVideoAspect, resolution: effResolution, durationSeconds: effDurationSeconds },
    };
    for (let i = 0; i < count; i++) {
      await createGeneration.mutateAsync({ ...base, idempotencyKey: crypto.randomUUID() });
    }
  };

  const generate = async () => {
    if (busyRef.current) return;
    const { text, refs: allRefs } = collectRefs(prompt.trim(), refs, candidates);
    if (!text) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      if (mode === "image") await generateImage(text, allRefs);
      else await generateVideo(text, allRefs);
      setPrompt("");
      setRefs([]);
      setEndFrame(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Generation failed.";
      setError({ text: message, credits: message === NO_CREDITS_MESSAGE });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const createVideoFrom = (g: FlowGeneration) => {
    setMode("video");
    setRefModeState("ingredients");
    addRef(refFromGeneration(g));
    promptRef.current?.focus();
  };

  // "Add to prompt" — the media menu's version of picking a candidate from
  // the "+" button: attaches the ref AND drops its @mention token into the
  // composer text at the cursor, so the reference reads in the prompt
  // instead of riding along silently as a chip.
  const addToPrompt = (g: FlowGeneration) => {
    const ref = refFromGeneration(g);
    addRef(ref);
    const { text, caret } = insertRefToken(prompt, ref, promptRef.current);
    setPrompt(text);
    requestAnimationFrame(() => {
      promptRef.current?.focus();
      promptRef.current?.setSelectionRange(caret, caret);
    });
  };

  const reusePrompt = (g: FlowGeneration) => {
    setPrompt(g.prompt);
    promptRef.current?.focus();
  };

  const [retryingId, setRetryingId] = useState<string | null>(null);
  // Resubmits a failed row's own prompt/model/parameters as a fresh
  // generation — a real, separately billed attempt, not a reopened one.
  // Its reference images (if any) are persisted (see submit.ts's
  // persistReferences), so this re-fetches and re-attaches them rather than
  // silently falling back to a text-only retry of what was a
  // reference-conditioned request.
  const retryGeneration = async (g: FlowGeneration) => {
    if (retryingId) return;
    setRetryingId(g.id);
    try {
      let inputs: Record<string, unknown> | undefined;
      if (g.referenceUrls.length > 0) {
        const images = await Promise.all(
          g.referenceUrls.map((url) => fetch(url).then((res) => res.blob()).then(blobToInline))
        );
        inputs = g.kind === "video" && g.refMode === "ingredients" ? { referenceImages: images } : { images };
      }
      await createGeneration.mutateAsync({
        kind: g.kind,
        prompt: g.prompt,
        provider: g.provider,
        model: g.model,
        tier: "",
        idempotencyKey: crypto.randomUUID(),
        ...(g.refMode ? { refMode: g.refMode } : {}),
        ...(inputs ? { inputs } : {}),
        parameters: g.parameters,
      });
    } catch {
      // The card's own status (still "failed") is the feedback; nothing else
      // to update here.
    } finally {
      setRetryingId(null);
    }
  };

  if (flow.isLoading) {
    return (
      <div className="grid h-full place-items-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }
  if (flow.isError || !flow.data) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 p-6 text-center">
        <p className="text-sm text-destructive">Couldn&apos;t load this Flow.</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => flow.refetch()}>
            Try again
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push(`${base}/ai-suite/image-video`)}>
            Back to Flows
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button
          size="icon"
          variant="ghost"
          title="Back to Flows"
          onClick={() => router.push(`${base}/ai-suite/image-video`)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium">{flow.data.flow.name}</h1>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {generations.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Describe an image or video below to start this Flow.
          </p>
        ) : (
          generations.map((g) => (
            <GenerationCard
              key={g.id}
              generation={g}
              infoOpen={infoOpenId === g.id}
              onToggleInfo={() => setInfoOpenId((id) => (id === g.id ? null : g.id))}
              onUseAsReference={() => addRef(refFromGeneration(g))}
              onCreateVideo={g.kind === "image" ? () => createVideoFrom(g) : undefined}
              onAddToPrompt={() => addToPrompt(g)}
              onReusePrompt={() => reusePrompt(g)}
              onSetCover={() => setCover.mutate({ id: flowId, generationId: g.id })}
              settingCover={setCover.isPending && setCover.variables?.generationId === g.id}
              coverFailed={setCover.isError && setCover.variables?.generationId === g.id}
              onDelete={() => deleteGeneration.mutate(g.id)}
              deleteFailed={deleteGeneration.isError && deleteGeneration.variables === g.id}
              onRetry={() => void retryGeneration(g)}
              retrying={retryingId === g.id}
            />
          ))
        )}
      </div>

      <div className="border-t p-3">
        <div
          className={cn(
            "relative flex flex-col rounded-2xl border border-input bg-card focus-within:border-ring",
            dragActive && "border-[#0a84ff] ring-2 ring-[#0a84ff]/30"
          )}
          onDragEnter={(e) => {
            if (!Array.from(e.dataTransfer.types).includes("Files")) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            if (!Array.from(e.dataTransfer.types).includes("Files")) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            if (e.dataTransfer.files.length === 0) return;
            e.preventDefault();
            setDragActive(false);
            for (const file of Array.from(e.dataTransfer.files)) {
              const ref = refFromLocalFile(file);
              if (mode === "video" && refMode === "frames" && !refs[0]) setRefs([ref]);
              else addRef(ref);
            }
          }}
        >
          <div className="flex items-center gap-1 px-2.5 pt-2.5">
            <ModeToggle
              mode={mode}
              onChange={(m) => {
                setMode(m);
                setRefs([]);
                setEndFrame(null);
              }}
            />
          </div>
          {acceptsReferences &&
            (mode === "video" && refMode === "frames" ? (
              <div className="flex shrink-0 items-center gap-1.5 p-2.5 pb-0">
                <FrameSlotButton
                  label="Start"
                  value={refs[0] ?? null}
                  onChange={(ref) => setRefs(ref ? [ref] : [])}
                  onUploadFile={(file) => setRefs([refFromLocalFile(file)])}
                />
                <button
                  type="button"
                  title="Swap start and end"
                  aria-label="Swap start and end frames"
                  disabled={!refs[0] && !endFrame}
                  className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  onClick={() => {
                    const start = refs[0] ?? null;
                    setRefs(endFrame ? [endFrame] : []);
                    setEndFrame(start);
                  }}
                >
                  <ArrowLeftRight className="size-3.5" />
                </button>
                <FrameSlotButton
                  label="End"
                  value={endFrame}
                  onChange={setEndFrame}
                  onUploadFile={(file) => setEndFrame(refFromLocalFile(file))}
                />
              </div>
            ) : (
              <RefChips
                refs={refs}
                onRemove={(r) => setRefs((prev) => prev.filter((x) => !(x.scope === r.scope && x.id === r.id)))}
                className="p-2.5 pb-0"
                thumbClassName="size-12"
              />
            ))}
          <MentionTextarea
            className="min-h-[80px] w-full resize-y bg-transparent px-3.5 py-3 text-[13px] leading-relaxed outline-none"
            placeholder={mode === "image" ? "Describe an image…" : "Describe a video…"}
            value={prompt}
            onChange={setPrompt}
            candidates={candidates}
            submitKey="mod-enter"
            menuSide="top"
            onSubmit={() => void generate()}
            attachedRefs={refs}
            uploadFile={(file) => Promise.resolve(refFromLocalFile(file))}
            inputRef={promptRef}
          />
          <div className="flex flex-col gap-2 px-3 pb-3">
            {settingsOpen && (
              <div className="flex flex-col gap-3 rounded-xl border border-input bg-muted/30 p-3">
                {mode === "image" ? (
                  <>
                    {selectableImageModels.length > 1 && (
                      <SegRow
                        title="Model"
                        value={imageTier}
                        onChange={setImageTier}
                        options={selectableImageModels.map((m) => ({ value: m.tier, label: m.label }))}
                      />
                    )}
                    <SegRow
                      title="Aspect ratio"
                      value={imageAspect}
                      onChange={setImageAspect}
                      options={IMAGE_ASPECTS.map((a) => ({ value: a, label: a }))}
                    />
                    <SegRow title="Number of results" value={count} onChange={setCount} options={COUNT_OPTIONS} />
                  </>
                ) : (
                  <>
                    {selectableVideoModels.length > 1 && (
                      <SegRow
                        title="Model"
                        value={videoTier}
                        onChange={setVideoTier}
                        options={selectableVideoModels.map((m) => ({ value: m.tier, label: m.model }))}
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
                    <SegRow title="Aspect ratio" value={effVideoAspect} onChange={setVideoAspect} options={videoAspectOptions} />
                    <SegRow title="Resolution" value={effResolution} onChange={setResolution} options={videoResolutionOptions} />
                    <div className="h-px shrink-0 bg-border" />
                    <SegRow
                      title="Duration"
                      value={effDurationSeconds}
                      onChange={setDurationSeconds}
                      options={videoDurationOptions}
                    />
                    {videoModel.provider === "gemini-omni" && (
                      <p className="px-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                        {OMNI_BEST_EFFORT_NOTE}
                      </p>
                    )}
                    <SegRow title="Number of takes" value={count} onChange={setCount} options={COUNT_OPTIONS} />
                  </>
                )}
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
                  <span className="truncate">{mode === "image" ? imageModel.label : videoModel.model}</span>
                  {count > 1 && <span>x{count}</span>}
                  <ChevronDown className="size-3.5 shrink-0" />
                </button>
                <button
                  type="button"
                  title={mode === "image" ? "Generate image" : "Generate video"}
                  aria-label={mode === "image" ? "Generate image" : "Generate video"}
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
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Generating runs on your Depcut account.{" "}
            <a className="font-medium text-blue-600 hover:underline dark:text-blue-400" href={signInUrl()}>
              Sign in
            </a>{" "}
            to continue.
          </p>
        ) : (
          error && (
            <p className="mt-2 text-[11px] leading-relaxed text-red-600">
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
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {(["image", "video"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-md px-3 py-1 text-[12px] font-medium capitalize transition-colors",
            mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function GenerationCard({
  generation: g,
  infoOpen,
  onToggleInfo,
  onUseAsReference,
  onCreateVideo,
  onAddToPrompt,
  onReusePrompt,
  onSetCover,
  settingCover,
  coverFailed,
  onDelete,
  deleteFailed,
  onRetry,
  retrying,
}: {
  generation: FlowGeneration;
  infoOpen: boolean;
  onToggleInfo: () => void;
  onUseAsReference: () => void;
  onCreateVideo?: () => void;
  onAddToPrompt: () => void;
  onReusePrompt: () => void;
  onSetCover: () => void;
  settingCover: boolean;
  coverFailed: boolean;
  onDelete: () => void;
  deleteFailed: boolean;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="relative overflow-hidden rounded-xl border bg-muted/30">
        {g.status === "in_progress" ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <p className="text-[11px]">{g.kind === "video" ? "Rendering…" : "Generating…"}</p>
          </div>
        ) : g.status === "failed" ? (
          <div className="flex aspect-video flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-[11px] text-red-600">{g.errorMessage ?? "Generation failed."}</p>
            <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
              {retrying ? <Loader2 className="size-3.5 animate-spin" /> : "Retry"}
            </Button>
          </div>
        ) : g.outputUrl ? (
          <GeneratedMediaMenu
            generation={g}
            onCreateVideo={onCreateVideo}
            onUseAsReference={onUseAsReference}
            onAddToPrompt={onAddToPrompt}
            onReusePrompt={onReusePrompt}
            onSetCover={onSetCover}
            settingCover={settingCover}
            onDelete={onDelete}
          >
            {g.kind === "video" ? (
              <video
                src={g.outputUrl}
                poster={g.posterUrl ?? undefined}
                controls
                playsInline
                className="w-full rounded-xl"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL, not a Next-optimizable asset
              <img src={g.outputUrl} alt={g.prompt} className="w-full rounded-xl" />
            )}
          </GeneratedMediaMenu>
        ) : null}
      </div>
      <div className="px-1">
        <button
          type="button"
          onClick={onToggleInfo}
          className="flex items-center gap-1 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          <Info className="size-3" /> {g.prompt.length > 80 ? `${g.prompt.slice(0, 80)}…` : g.prompt}
        </button>
        {deleteFailed && <p className="mt-1 text-[10.5px] text-destructive">Couldn&apos;t delete this — try again.</p>}
        {coverFailed && (
          <p className="mt-1 text-[10.5px] text-destructive">Couldn&apos;t set this as the Flow cover — try again.</p>
        )}
        {infoOpen && (
          <div className="mt-1 space-y-1.5 rounded-lg bg-muted/50 p-2 text-[10.5px] text-muted-foreground">
            <p className="whitespace-pre-wrap text-foreground">{g.prompt}</p>
            <p>
              {g.model} · {g.kind}
              {g.refMode ? ` · ${g.refMode}` : ""}
            </p>
            {g.referenceUrls.length > 0 && (
              <div>
                <p className="mb-1">Reference{g.referenceUrls.length > 1 ? "s" : ""} used</p>
                <div className="flex flex-wrap gap-1">
                  {g.referenceUrls.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL, not a Next-optimizable asset
                    <img key={i} src={url} alt="" className="size-10 rounded-md border object-cover" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The action menu for one generated image/video card — Depcut's answer to
 * the OS's own long-press image menu (Share/Save/Copy), which otherwise
 * fires instead of anything app-specific. Opens on a visible three-dot
 * button (works with a keyboard or a tap, no hover required), a desktop
 * right-click, or a mobile long-press — all three land on the same
 * controlled DropdownMenu instance so there's one menu, one set of actions,
 * regardless of how it was opened. The native browser/OS context menu is
 * suppressed only on the media wrapper below, not anywhere else on the page.
 */
function GeneratedMediaMenu({
  generation: g,
  onCreateVideo,
  onUseAsReference,
  onAddToPrompt,
  onReusePrompt,
  onSetCover,
  settingCover,
  onDelete,
  children,
}: {
  generation: FlowGeneration;
  onCreateVideo?: () => void;
  onUseAsReference: () => void;
  onAddToPrompt: () => void;
  onReusePrompt: () => void;
  onSetCover: () => void;
  settingCover: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressStart.current = null;
  };

  const download = () => {
    if (!g.outputUrl) return;
    const a = document.createElement("a");
    a.href = g.outputUrl;
    a.download = `${g.kind}-${g.id}.${g.kind === "video" ? "mp4" : "png"}`;
    a.click();
  };

  return (
    <div className="relative">
      <div
        className="[-webkit-touch-callout:none] select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        onPointerDown={(e) => {
          // Only a touch/pen press starts the long-press timer — a mouse
          // already has right-click, and a long mouse-down (e.g. dragging
          // the video scrubber) must not also pop the menu.
          if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
          pressStart.current = { x: e.clientX, y: e.clientY };
          pressTimer.current = setTimeout(() => {
            pressTimer.current = null;
            setOpen(true);
          }, 500);
        }}
        onPointerMove={(e) => {
          if (!pressStart.current) return;
          // A real drag (scrubbing video, a scroll starting here) cancels
          // the hold instead of popping the menu mid-gesture.
          const dx = e.clientX - pressStart.current.x;
          const dy = e.clientY - pressStart.current.y;
          if (Math.hypot(dx, dy) > 10) clearPress();
        }}
        onPointerUp={clearPress}
        onPointerLeave={clearPress}
        onPointerCancel={clearPress}
      >
        {children}
      </div>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          title="Media options"
          className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 data-[state=open]:bg-black/75"
        >
          <MoreVertical className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {onCreateVideo && (
            <DropdownMenuItem onClick={onCreateVideo}>
              <Clapperboard /> Animate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onAddToPrompt}>
            <AtSign /> Add to prompt
          </DropdownMenuItem>
          {g.kind === "image" && (
            <DropdownMenuItem onClick={onUseAsReference}>
              <ImagePlus /> Use as reference
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onReusePrompt}>
            <RotateCcw /> Reuse prompt
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onSetCover} disabled={settingCover}>
            <ImageIcon /> Set Flow cover
          </DropdownMenuItem>
          <DropdownMenuItem onClick={download}>
            <Download /> Download
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
