"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { AudioPlayer } from "@/cut/components/AudioPlayer";
import { useAdminContentAudio, type AdminContentOwner } from "@/queries/admin";
import { cn } from "@/lib/utils";

function ownerLabel(owner: AdminContentOwner | null): string {
  if (!owner) return "Deleted account";
  return owner.displayName || owner.name || owner.email;
}

const FILTERS: { label: string; value: "text-to-speech" | "dubbing" | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Text to Speech", value: "text-to-speech" },
  { label: "Dubbing", value: "dubbing" },
];

export default function AdminContentAudioPage() {
  const [tool, setTool] = useState<"text-to-speech" | "dubbing" | undefined>(undefined);
  const audio = useAdminContentAudio(tool);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">AI Generated Audio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every account's Text to Speech and Dubbing render, most recent first.
        </p>
      </div>

      <div className="flex gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => setTool(f.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              tool === f.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {audio.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : audio.isError ? (
        <p className="text-sm text-destructive">Couldn&apos;t load audio. Try again.</p>
      ) : audio.data?.items.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nothing rendered yet.</p>
      ) : (
        <div className="space-y-3">
          {audio.data?.items.map((a) => (
            <div key={a.id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={a.script}>
                    {a.script}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {ownerLabel(a.owner)} ·{" "}
                    {a.tool === "text-to-speech" ? "Text to Speech" : "Dubbing"}
                    {a.tool === "dubbing" && a.sourceLabel ? ` · ${a.sourceLabel}` : ""}
                    {a.targetLanguage ? ` → ${a.targetLanguage}` : ""} · {a.voice} ·{" "}
                    {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <AudioPlayer src={a.outputUrl} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
