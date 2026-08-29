"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";

import { SectionTitle } from "@/cut/components/SectionTitle";
import { cn } from "@/lib/utils";
import { useToolHistory, type ToolHistoryEntry, type ToolHistoryTool } from "@/lib/toolHistory";

const PREVIEW_COUNT = 5;

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Past generations for one AI Suite tool — stored in this browser only (see
// lib/toolHistory.ts), not on the server. Always shown, even before a first
// generation, so the feature is discoverable rather than appearing out of
// nowhere; shows the most recent PREVIEW_COUNT with a "View all" for the
// rest (capped at MAX_PER_TOOL total — see lib/toolHistory.ts).
export function ToolHistoryList({
  tool,
  onReuse,
  renderPreview,
}: {
  tool: ToolHistoryTool;
  onReuse: (inputs: Record<string, unknown>) => void;
  renderPreview: (entry: ToolHistoryEntry) => ReactNode;
}) {
  const { entries, remove } = useToolHistory(tool);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? entries : entries.slice(0, PREVIEW_COUNT);

  return (
    <div className="space-y-3 rounded-3xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <SectionTitle>Recent History</SectionTitle>
        {entries.length > PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            {showAll ? "Show less" : `View all (${entries.length})`}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing generated yet — your results will show up here.
        </p>
      ) : (
        <div className="space-y-1.5">
          {visible.map((entry) => {
            const open = openId === entry.id;
            return (
              <div key={entry.id} className="rounded-xl border bg-muted/20">
                <div className="flex items-center gap-1.5 p-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronDown
                      className={cn(
                        "size-3.5 shrink-0 text-muted-foreground transition-transform",
                        open && "rotate-180",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{entry.summary}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {timeAgo(entry.createdAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Use again"
                    onClick={() => onReuse(entry.inputs)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => remove(entry.id)}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {open && <div className="border-t p-2.5">{renderPreview(entry)}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
