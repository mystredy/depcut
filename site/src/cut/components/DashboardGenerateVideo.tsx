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
import { VIDEO_ASPECT_LABEL, type VideoAspect } from "@/cut/lib/videoModels";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { PillSelect } from "./PillSelect";

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
  const [busy, setBusy] = useState(false);

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
      useGenerate.getState().generateVideo(project.id, text, { aspect, composeRefs: true });
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
      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-input px-2.5 py-1 text-[12px] font-medium text-muted-foreground">
            Omni Flash
          </span>
          <PillSelect
            title="Aspect ratio"
            value={aspect}
            display={VIDEO_ASPECT_LABEL[aspect].split(" ")[0]}
            options={(["16:9", "9:16"] as VideoAspect[]).map((a) => ({
              value: a,
              label: VIDEO_ASPECT_LABEL[a],
            }))}
            onChange={setAspect}
            className="py-1 pr-2 pl-3 text-[12px]"
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
  );
}
