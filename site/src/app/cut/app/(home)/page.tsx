"use client";

import Link from "next/link";
import { NewProjectLauncher } from "@/cut/components/NewProjectLauncher";
import { GROUPS } from "@/cut/lib/navData";
import { useCutBase } from "@/cut/lib/nav";

const STUDIO_TOOLS = GROUPS.find((g) => g.key === "ai-suite")!.children;

export default function DashboardPage() {
  const base = useCutBase();

  return (
    <div className="space-y-5 p-6">
      <NewProjectLauncher source="dashboard" className="w-full sm:w-auto" />
      <div className="space-y-5 rounded-3xl border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Studio Tools
          </h2>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            AI Suite
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {STUDIO_TOOLS.map(({ slug, label, icon: Icon }) => (
            <Link
              key={slug}
              href={`${base}/ai-suite/${slug}`}
              className="flex h-12 items-center gap-2.5 rounded-2xl border bg-background px-3.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-primary">
                <Icon className="size-4" />
              </span>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
