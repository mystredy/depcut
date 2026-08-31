"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowUp,
  Clock,
  Film,
  Layers,
  Loader2,
  Plus,
  Scaling,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import { useSelectableModels } from "@/cut/lib/aiModelAvailability";
import { useAssetDrop } from "@/cut/lib/assetRef";
import { seedNewProjectDoc } from "@/cut/lib/docCache";
import { useGenerate } from "@/cut/lib/generate";
import { projectHref, useCutBase } from "@/cut/lib/nav";
import { patchProjects } from "@/cut/lib/queries";
import { refsFromDroppedFiles } from "@/cut/lib/refMedia";
import { activeResidency, backendFor } from "@/cut/lib/residency";
import type { ProjectSummary } from "@/cut/lib/types";
import { nearestAspect } from "@/cut/lib/types";
import { useLocalPref } from "@/cut/lib/uiState";
import type { VideoRefMode } from "@/cut/lib/videoGen";
import {
  VIDEO_ASPECT_LABEL,
  VIDEO_MODELS,
  type VideoAspect,
  type VideoModelOption,
  type VideoResolution,
} from "@/cut/lib/videoModels";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import {
  COUNT_OPTIONS,
  DURATION_OPTIONS,
  IconBadge,
  IconSelect,
  OMNI_BEST_EFFORT_NOTE,
  REF_MODE_OPTIONS,
  RESOLUTION_OPTIONS,
  SegRow,
} from "./VideoGenControls";

/** A one-shot text-to-video composer for the dashboard: describe a clip, hit
 * go, and land in a brand-new project with the render already under way —
 * the same generateVideo call the editor's own Video tab uses, just fired
 * before a project exists yet instead of inside one.
 *
 * References work differently here than in the editor: no project exists
 * yet to hold Media, and the account's Library isn't wired into this
 * composer, so the Image/Start/End slots only take raw file uploads (picked
 * or dropped) — staged as plain Files and imported into the brand-new
 * project at generate time, right before the render request.
 *
 * Image and the Start/End pair are mutually exclusive, mirroring the
 * backend's own constraint: a render takes a seed frame (Start/End) or
 * identity reference images (Image), never both — the same "How references
 * are used" choice the editor's Video tab offers, just driving which slot(s)
 * show instead of conditioning a shared attachment. Switching modes clears
 * whatever was staged in the other one rather than leaving it attached but
 * hidden. */
export function DashboardGenerateVideo({ className }: { className?: string }) {
  const router = useRouter();
  const base = useCutBase();
  const client = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<VideoAspect>("16:9");
  const [refMode, setRefModeState] = useState<VideoRefMode>("frames");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const setRefMode = (mode: VideoRefMode) => {
    setRefModeState(mode);
    setImageFile(null);
    setStartFile(null);
    setEndFile(null);
  };
  // Shares the editor Video tab's own localStorage keys, so a pick made here
  // is still the pick showing there (and back) — one set of "last used"
  // knobs for both composers.
  const [tier, setTier] = useLocalPref<VideoModelOption["tier"]>(
    "cut-gen-tier",
    "omni",
    (v) => VIDEO_MODELS.some((m) => m.tier === v)
  );
  const [resolution, setResolution] = useLocalPref<VideoResolution>(
    "cut-gen-resolution",
    "720p",
    (v) => v === "360p" || v === "720p" || v === "1080p"
  );
  const [durationSeconds, setDurationSeconds] = useLocalPref<number>(
    "cut-gen-duration",
    8,
    (v) => typeof v === "number"
  );
  const [count, setCount] = useLocalPref<1 | 2 | 3 | 4>(
    "cut-gen-video-count",
    1,
    (v) => v === 1 || v === 2 || v === 3 || v === 4
  );
  const [busy, setBusy] = useState(false);
  // The aspect/duration/takes knobs live behind one toggle — model and
  // resolution get their own always-visible quick pickers below.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Narrowed to whatever an admin has actually left enabled
  // (/admin/settings/ai-models); falls back to the full list while that
  // loads or if nothing's enabled, so the picker is never empty.
  const selectableModels = useSelectableModels("video", VIDEO_MODELS);

  // Clamped to the picked model's own set, same as the editor's Video tab —
  // a Veo-only pick (say, 1080p) never leaks into an Omni request or vice
  // versa when switching models here.
  const model = selectableModels.find((m) => m.tier === tier) ?? selectableModels[0];
  const effAspect = nearestAspect(aspect, model.aspects);
  const resolutionOptions = RESOLUTION_OPTIONS[model.provider] ?? RESOLUTION_OPTIONS["gemini-omni"];
  const durationOptions = DURATION_OPTIONS[model.provider] ?? DURATION_OPTIONS["gemini-omni"];
  const effResolution = resolutionOptions.some((o) => o.value === resolution)
    ? resolution
    : resolutionOptions[0].value;
  const effDurationSeconds = durationOptions.some((o) => o.value === durationSeconds)
    ? durationSeconds
    : durationOptions[durationOptions.length - 1].value;
  const aspectOptions = model.aspects.map((a) => ({
    value: a,
    label: VIDEO_ASPECT_LABEL[a].split(" ")[0],
  }));

  const hasImage = imageFile !== null;
  const acceptsReferences = model.maxReferenceImages > 0;

  // A model switch that drops reference support (rare today — every current
  // tier accepts at least one — but the picker is admin-extensible) leaves
  // no staged file behind for a request that would just ignore it. Adjusted
  // during render rather than an effect, per React's own guidance for state
  // that tracks a prop/derived value: https://react.dev/learn/you-might-not-need-an-effect
  const [prevAcceptsReferences, setPrevAcceptsReferences] = useState(acceptsReferences);
  if (prevAcceptsReferences !== acceptsReferences) {
    setPrevAcceptsReferences(acceptsReferences);
    if (!acceptsReferences) {
      setImageFile(null);
      setStartFile(null);
      setEndFile(null);
    }
  }

  const go = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const residency = activeResidency();
      const res = await backendFor(residency).fetch("/api/cut/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: text.slice(0, 60) || "Untitled" }),
      });
      const project = (await res.json()) as ProjectSummary;
      patchProjects(client, residency, (s) => ({
        ...s,
        projects: [project, ...s.projects],
      }));
      seedNewProjectDoc(project.id, project.name, residency);
      track("project_created", { source: "dashboard_video_gen" });

      // Staged files only import into the project once, here — the count
      // loop below reuses the same landed refs for every take rather than
      // re-uploading per take.
      const [imageRef, startRef, endRef] = await Promise.all([
        hasImage && imageFile
          ? refsFromDroppedFiles(project.id, [imageFile]).then((rs) => rs[0])
          : Promise.resolve(undefined),
        !hasImage && startFile
          ? refsFromDroppedFiles(project.id, [startFile]).then((rs) => rs[0])
          : Promise.resolve(undefined),
        !hasImage && endFile
          ? refsFromDroppedFiles(project.id, [endFile]).then((rs) => rs[0])
          : Promise.resolve(undefined),
      ]);

      for (let i = 0; i < count; i++) {
        useGenerate.getState().generateVideo(project.id, text, {
          tier,
          aspect: effAspect,
          resolution: effResolution,
          durationSeconds: effDurationSeconds,
          ...(imageRef
            ? // Identity anchor: the prompt rides as written, no compose rewrite.
              { referenceImages: [imageRef], composeRefs: false }
            : {
                ...(startRef ? { refs: [startRef] } : {}),
                ...(endRef ? { endFrame: endRef } : {}),
                composeRefs: true,
              }),
        });
      }
      router.push(projectHref(base, project.id, "dashboard", null));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl border border-input bg-card focus-within:border-ring",
        className
      )}
    >
      {acceptsReferences && (
        <div className="flex items-center gap-1.5 px-3 pt-3">
          {refMode === "frames" ? (
            <>
              <FileSlot label="Start frame" file={startFile} onChange={setStartFile} />
              <button
                type="button"
                title="Swap start and end"
                aria-label="Swap start and end"
                onClick={() => {
                  setStartFile(endFile);
                  setEndFile(startFile);
                }}
                className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ArrowLeftRight className="size-3.5" />
              </button>
              <FileSlot label="End frame" file={endFile} onChange={setEndFile} />
            </>
          ) : (
            <FileSlot label="Image" file={imageFile} onChange={setImageFile} />
          )}
        </div>
      )}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void go();
          }
        }}
        placeholder="Describe your video…"
        disabled={busy}
        className="min-h-[64px] w-full resize-none bg-transparent px-4 pt-2.5 pb-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      <div className="flex flex-col gap-2 px-3 pb-3">
        {settingsOpen && (
          <div className="flex flex-col gap-2">
            {acceptsReferences && (
              <SegRow
                title="How references are used"
                value={refMode}
                onChange={setRefMode}
                options={REF_MODE_OPTIONS}
              />
            )}
            <SegRow title="Aspect ratio" value={effAspect} onChange={setAspect} options={aspectOptions} />
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
            <IconBadge
              icon={Layers}
              label="Number of takes"
              value={String(count)}
              onClick={() => setSettingsOpen(true)}
            />
            <IconBadge
              icon={Clock}
              label="Duration"
              value={`${effDurationSeconds}s`}
              onClick={() => setSettingsOpen(true)}
            />
            <IconBadge
              icon={Scaling}
              label="Aspect ratio"
              value={effAspect}
              onClick={() => setSettingsOpen(true)}
            />
          </div>
          <button
            type="button"
            title="Generate video"
            aria-label="Generate video"
            disabled={!prompt.trim() || busy}
            onClick={() => void go()}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/** A picked file's object URL, revoked on change/unmount. */
function useFilePreview(file: File | null): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  // Only the cleanup is an effect — the URL itself is a pure function of
  // `file`, computed above during render, not state to hold and sync.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}

function FilePreview({ file, url }: { file: File; url: string }) {
  return file.type.startsWith("video") ? (
    <video src={url} muted playsInline className="size-full object-cover" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a Next-optimizable asset
    <img src={url} alt={file.name} className="size-full object-cover" />
  );
}

/** A single staged reference — pick or drop to fill it, an "x" to clear it.
 * No Media/Library here (see the component doc comment): a plain file
 * picker plus a drop zone. */
function FileSlot({
  label,
  file,
  onChange,
  disabled,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const url = useFilePreview(file);
  const inputRef = useRef<HTMLInputElement>(null);
  const { active, attachTarget, targetProps } = useAssetDrop(
    // Nothing else on this page carries a draggable app ref to drop here —
    // only OS files matter.
    () => {},
    (files) => {
      const picked = files[0];
      if (picked) onChange(picked);
    }
  );

  if (file && url) {
    return (
      <div
        ref={attachTarget}
        {...targetProps}
        className={cn(
          "relative size-8 shrink-0 overflow-hidden rounded-full border",
          active ? "border-[#0a84ff] ring-2 ring-[#0a84ff]/30" : "border-border"
        )}
      >
        <FilePreview file={file} url={url} />
        <button
          type="button"
          title={`Remove ${label.toLowerCase()}`}
          className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-black/70 text-white hover:bg-black/90"
          onClick={() => onChange(null)}
        >
          <X className="size-2.5" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        ref={attachTarget}
        {...targetProps}
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
          active
            ? "border-[#0a84ff] bg-[#0a84ff]/10 text-[#0a84ff]"
            : "border-input text-foreground hover:bg-muted"
        )}
      >
        <Plus className="size-3.5" />
        {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked) onChange(picked);
        }}
      />
    </>
  );
}

