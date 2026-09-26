"use client";

import Link from "next/link";
import { NewProjectLauncher } from "@/cut/components/NewProjectLauncher";
import { VideoGenerator } from "@/cut/components/VideoGenerator";
import { GROUPS } from "@/cut/lib/navData";
import { useCutBase } from "@/cut/lib/nav";
import { cn } from "@/lib/utils";

const AI_SUITE_TOOLS = GROUPS.find((g) => g.key === "ai")!.children;
// The generate box below the row is Text to Video, so it leads the row
// instead of sitting wherever it falls in the shared nav order.
const STUDIO_TOOLS = [
  AI_SUITE_TOOLS.find((t) => t.slug === "text-to-video")!,
  ...AI_SUITE_TOOLS.filter((t) => t.slug !== "text-to-video"),
];

export default function DashboardPage() {
  const base = useCutBase();

  return (
    <div className="space-y-5 p-6">
      <NewProjectLauncher source="dashboard" className="w-full sm:w-auto" />
      {/* A single scrollable row of pills instead of a grid — a grid ran
          several rows tall on narrow screens and pushed the prompt box
          down; a scroll strip stays a fixed height at any width. */}
      <div className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STUDIO_TOOLS.map(({ slug, label, icon: Icon }) => {
          // The generate box right below this row already is Text to
          // Video — shown selected here instead of just another link to it.
          const selected = slug === "text-to-video";
          return (
            <Link
              key={slug}
              href={`${base}/ai/${slug}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                selected
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background hover:border-primary/50 hover:bg-muted"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
      <VideoGenerator />
    </div>
  );
}
