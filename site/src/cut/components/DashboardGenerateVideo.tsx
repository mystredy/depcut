"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2, Plus, X } from "lucide-react";
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
import { PillSelect } from "./PillSelect";
import {
  COUNT_OPTIONS,
  DURATION_OPTIONS,
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
 * composer, so Frames/Ingredients only take raw file uploads (picked or
 * dropped) — staged as plain Files and imported into the brand-new project
 * at generate time, right before the render request. */
export function DashboardGenerateVideo({ className }: { className?: string }) {
  const router = useRouter();
  const base = useCutBase();
  const client = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<VideoAspect>("16:9");
  const [refMode, setRefMode] = useState<VideoRefMode>("frames");
  const [startFile, setStartFile] = useState<File | null>(null);
  const [endFile, setEndFile] = useState<File | null>(null);
  const [ingredientFiles, setIngredientFiles] = useState<File[]>([]);
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

  // Clamped to the picked model's own set, same as the editor's Video tab —
  // a Veo-only pick (say, 1080p) never leaks into an Omni request or vice
  // versa when switching models here.
  const model = VIDEO_MODELS.find((m) => m.tier === tier) ?? VIDEO_MODELS[0];
  const effAspect = nearestAspect(aspect, model.aspects);
  const resolutionOptions = RESOLUTION_OPTIONS[model.provider] ?? RESOLUTION_OPTIONS["gemini-omni"];
  const durationOptions = DURATION_OPTIONS[model.provider] ?? DURATION_OPTIONS["gemini-omni"];
  const effResolution = resolutionOptions.some((o) => o.value === resolution)
    ? resolution
    : resolutionOptions[0].value;
  const effDurationSeconds = durationOptions.some((o) => o.value === durationSeconds)
    ? durationSeconds
    : durationOptions[durationOptions.length - 1].value;
  // Ingredient slots are capped the same way the editor caps identity
  // anchors — the registry's per-model reference-image limit.
  const ingredientFilesCapped = ingredientFiles.slice(0, model.maxReferenceImages);

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
      const asIngredients = refMode === "ingredients" && ingredientFilesCapped.length > 0;
      const [startRef, endRef, referenceImages] = await Promise.all([
        !asIngredients && startFile
          ? refsFromDroppedFiles(project.id, [startFile]).then((rs) => rs[0])
          : Promise.resolve(undefined),
        !asIngredients && endFile
          ? refsFromDroppedFiles(project.id, [endFile]).then((rs) => rs[0])
          : Promise.resolve(undefined),
        asIngredients
          ? refsFromDroppedFiles(project.id, ingredientFilesCapped)
          : Promise.resolve([]),
      ]);

      for (let i = 0; i < count; i++) {
        useGenerate.getState().generateVideo(project.id, text, {
          tier,
          aspect: effAspect,
          resolution: effResolution,
          durationSeconds: effDurationSeconds,
          ...(asIngredients
            ? // Identity anchors: the prompt rides as written, no compose rewrite.
              { referenceImages, composeRefs: false }
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
        className="min-h-[72px] w-full resize-none bg-transparent px-4 pt-3.5 pb-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      <div className="flex flex-col gap-2 px-3 pb-3">
        <SegRow
          title="How references are used"
          value={refMode}
          onChange={setRefMode}
          options={REF_MODE_OPTIONS}
        />
        {refMode === "frames" ? (
          <div className="flex items-center gap-1.5 px-0.5">
            <FileSlot label="Start" file={startFile} onChange={setStartFile} />
            <span className="text-muted-foreground">⇄</span>
            <FileSlot label="End" file={endFile} onChange={setEndFile} />
          </div>
        ) : (
          <IngredientRow
            files={ingredientFilesCapped}
            onChange={setIngredientFiles}
            max={model.maxReferenceImages}
          />
        )}
        <div className="flex items-center gap-1.5">
          <PillSelect
            title="Model"
            value={tier}
            display={model.model}
            options={VIDEO_MODELS.map((m) => ({ value: m.tier, label: m.model }))}
            onChange={setTier}
            className="py-1 pr-2 pl-3 text-[12px]"
          />
          <PillSelect
            title="Aspect ratio"
            value={effAspect}
            display={VIDEO_ASPECT_LABEL[effAspect].split(" ")[0]}
            options={model.aspects.map((a) => ({
              value: a,
              label: VIDEO_ASPECT_LABEL[a],
            }))}
            onChange={setAspect}
            className="py-1 pr-2 pl-3 text-[12px]"
          />
        </div>
        <SegRow
          title="Resolution"
          value={effResolution}
          onChange={setResolution}
          options={resolutionOptions}
        />
        <SegRow
          title="Duration"
          value={effDurationSeconds}
          onChange={setDurationSeconds}
          options={durationOptions}
        />
        <div className="flex items-center justify-between gap-2">
          <SegRow
            title="Number of takes"
            value={count}
            onChange={setCount}
            options={COUNT_OPTIONS}
            className="flex-1"
          />
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

/** The Start/End slot in Frames mode — a single staged file, pick or drop to
 * fill it, a small "x" to clear it. No Media/Library here (see the
 * component doc comment): a plain file picker plus a drop zone. */
function FileSlot({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
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
          "relative size-14 shrink-0 overflow-hidden rounded-xl border",
          active ? "border-[#0a84ff] ring-2 ring-[#0a84ff]/30" : "border-border"
        )}
      >
        <FilePreview file={file} url={url} />
        <button
          type="button"
          title={`Remove ${label.toLowerCase()}`}
          className="absolute top-0.5 right-0.5 grid size-4.5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
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
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex h-14 shrink-0 items-center justify-center rounded-xl border px-4 text-[13px] font-medium transition-colors",
          active
            ? "border-[#0a84ff] bg-[#0a84ff]/10 text-[#0a84ff]"
            : "border-border text-foreground hover:bg-muted"
        )}
      >
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

/** Ingredients mode's attachments: up to the model's reference-image limit,
 * each a staged file with its own remove button, plus an add tile. */
function IngredientRow({
  files,
  onChange,
  max,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {files.map((file, i) => (
        <IngredientThumb
          key={i}
          file={file}
          onRemove={() => onChange(files.filter((_, j) => j !== i))}
        />
      ))}
      {files.length < max && (
        <>
          <button
            type="button"
            title="Add ingredient"
            onClick={() => inputRef.current?.click()}
            className="grid size-14 shrink-0 place-items-center rounded-xl border border-dashed border-border text-muted-foreground hover:bg-muted"
          >
            <Plus className="size-4" />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (picked.length > 0) onChange([...files, ...picked].slice(0, max));
            }}
          />
        </>
      )}
    </div>
  );
}

function IngredientThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useFilePreview(file);
  return (
    <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-border">
      {url && <FilePreview file={file} url={url} />}
      <button
        type="button"
        title="Remove"
        className="absolute top-0.5 right-0.5 grid size-4.5 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
        onClick={onRemove}
      >
        <X className="size-2.5" />
      </button>
    </div>
  );
}
