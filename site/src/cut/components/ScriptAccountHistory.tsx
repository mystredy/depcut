"use client";

import { useState } from "react";
import { Clipboard, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { useDeleteGeneration, useGenerationHistory } from "@/queries/generationHistory";

type ScriptHistoryEntry = {
  id: string;
  topic: string;
  duration: string;
  platform: string;
  tone: string | null;
  status: string;
  script: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// The server-saved Scripting history — same "Account History" pattern as
// TranscriptionAccountHistory.tsx, its own component rather than the shared
// generic since a script's fields (topic/platform/tone) don't overlap with
// a transcript's (sourceType/sourceLabel).
export function ScriptAccountHistory() {
  const history = useGenerationHistory<ScriptHistoryEntry>("scripts", "scripts");
  const del = useDeleteGeneration("scripts");
  const [detailEntry, setDetailEntry] = useState<ScriptHistoryEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const copyDetail = () => {
    if (!detailEntry?.script) return;
    void navigator.clipboard.writeText(detailEntry.script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="space-y-3">
      <SectionTitle>Account History</SectionTitle>

      {history.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : history.isError ? (
        <p className="text-xs text-destructive">Couldn&apos;t load your saved scripts.</p>
      ) : !history.data || history.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing saved to your account yet — a script here will show up here.
        </p>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Platform</TableHead>
              <TableHead>Topic</TableHead>
              <TableHead className="w-32 text-right">Saved</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((entry) => (
              <TableRow key={entry.id} className="cursor-pointer" onClick={() => setDetailEntry(entry)}>
                <TableCell className="text-xs text-muted-foreground">{entry.platform}</TableCell>
                <TableCell className="truncate text-xs font-medium">{entry.topic}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {entry.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      del.mutate(entry.id);
                    }}
                    title="Delete"
                    className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="min-w-0 truncate">{detailEntry?.topic}</DialogTitle>
          </DialogHeader>
          {detailEntry &&
            (detailEntry.status === "failed" ? (
              <p className="text-[12.5px] leading-relaxed text-red-600">{detailEntry.errorMessage}</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={copyDetail}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <Clipboard className="size-3.5" />
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <p className="max-h-80 overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-wrap">
                  {detailEntry.script}
                </p>
              </div>
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
