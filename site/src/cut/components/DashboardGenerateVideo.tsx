"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { seedNewProjectDoc } from "@/cut/lib/docCache";
import { useGenerate } from "@/cut/lib/generate";
import { projectHref, useCutBase } from "@/cut/lib/nav";
import { patchProjects } from "@/cut/lib/queries";
import { activeResidency, backendFor } from "@/cut/lib/residency";
import type { ProjectSummary } from "@/cut/lib/types";
import { nearestAspect } from "@/cut/lib/types";
import { useLocalPref } from "@/cut/lib/uiState";
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
import { COUNT_OPTIONS, DURATION_OPTIONS, RESOLUTION_OPTIONS, SegRow } from "./VideoGenControls";

/** A one-shot text-to-video composer for the dashboard: describe a clip, hit
 * go, and land in a brand-new project with the render already under way —
 * the same generateVideo call the editor's own Video tab uses, just fired
 * before a project exists yet instead of inside one. */
export function DashboardGenerateVideo({ className }: { className?: string }) {
  const router = useRouter();
  const base = useCutBase();
  const client = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<VideoAspect>("16:9");
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
      for (let i = 0; i < count; i++) {
        useGenerate.getState().generateVideo(project.id, text, {
          tier,
          aspect: effAspect,
          resolution: effResolution,
          durationSeconds: effDurationSeconds,
          composeRefs: true,
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
