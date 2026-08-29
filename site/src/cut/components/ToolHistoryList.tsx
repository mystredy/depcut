"use client";

import { useState, type ReactNode } from "react";
import {
  Clipboard,
  Download,
  EllipsisVertical,
  Loader2,
  PencilLine,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SectionTitle } from "@/cut/components/SectionTitle";
import {
  useToolHistory,
  type ToolHistoryEntry,
  type ToolHistoryResult,
  type ToolHistoryTool,
} from "@/lib/toolHistory";
import {
  canCopyEntry,
  canShareEntry,
  copyEntryToClipboard,
  downloadBlob,
  exportAsDocx,
  exportAsHtml,
  exportAsJson,
  exportAsPdf,
  exportAsTxt,
  safeExportName,
  shareEntry,
} from "@/lib/toolHistoryExport";

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

// Split out so the "text" vs "blob" narrowing is on a real component prop
// (not a re-accessed `entry.result.kind` check) — narrowing on a property
// path doesn't survive into the onClick closures below it, but narrowing a
// prop's own declared type does.
function TextExportMenu({
  entry,
  result,
  name,
}: {
  entry: Extract<ToolHistoryEntry, { status: "succeeded" }>;
  result: Extract<ToolHistoryResult, { kind: "text" }>;
  name: string;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Download /> Quick export
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem onClick={() => exportAsTxt(result.text, name)}>Text</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsPdf(result.text, name)}>PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={() => void exportAsDocx(result.text, name)}>DOCX</DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsHtml(result.text, entry.summary, name)}>
          HTML
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAsJson(entry, name)}>JSON</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

function BlobDownloadItem({ result }: { result: Extract<ToolHistoryResult, { kind: "blob" }> }) {
  return (
    <DropdownMenuItem onClick={() => downloadBlob(result.blob, result.filename)}>
      <Download /> Download
    </DropdownMenuItem>
  );
}

function HistoryRow({
  entry,
  onOpen,
  onReuse,
  onRemove,
  onRename,
}: {
  entry: ToolHistoryEntry;
  onOpen: () => void;
  onReuse: (inputs: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  onRename: (entry: ToolHistoryEntry) => void;
}) {
  const name = safeExportName(entry.summary);

  return (
    <TableRow className="cursor-pointer" onClick={onOpen}>
      <TableCell className="truncate text-xs font-medium">{entry.summary}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-2">
          {entry.status === "failed" && <Badge variant="destructive">Failed</Badge>}
          {entry.status === "pending" && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="size-3 animate-spin" /> Processing
            </Badge>
          )}
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
          <DropdownMenu>
            <DropdownMenuTrigger
              onClick={(e) => e.stopPropagation()}
              className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <EllipsisVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {entry.status === "succeeded" && (
                <>
                  {entry.result.kind === "text" ? (
                    <TextExportMenu entry={entry} result={entry.result} name={name} />
                  ) : (
                    <BlobDownloadItem result={entry.result} />
                  )}
                  {canCopyEntry(entry) && (
                    <DropdownMenuItem onClick={() => void copyEntryToClipboard(entry)}>
                      <Clipboard /> Copy to clipboard
                    </DropdownMenuItem>
                  )}
                  {canShareEntry(entry, name) && (
                    <DropdownMenuItem onClick={() => void shareEntry(entry, entry.summary, name)}>
                      <Share2 /> Share
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onRename(entry)}>
                <PencilLine /> Edit name
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReuse(entry.inputs)}>
                <RotateCcw /> Use again
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => onRemove(entry.id)}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function HistoryTable({
  entries,
  onOpen,
  onReuse,
  onRemove,
  onRename,
}: {
  entries: ToolHistoryEntry[];
  onOpen: (entry: ToolHistoryEntry) => void;
  onReuse: (inputs: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  onRename: (entry: ToolHistoryEntry) => void;
}) {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead className="w-44 text-right">Created at</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <HistoryRow
            key={entry.id}
            entry={entry}
            onOpen={() => onOpen(entry)}
            onReuse={onReuse}
            onRemove={onRemove}
            onRename={onRename}
          />
        ))}
      </TableBody>
    </Table>
  );
}

// Past generations for one AI Suite tool — stored in this browser only (see
// lib/toolHistory.ts), not on the server. Always shown, even before a first
// generation, so the feature is discoverable rather than appearing out of
// nowhere; shows the most recent PREVIEW_COUNT with a "View all" modal for
// the rest (capped at MAX_PER_TOOL total — see lib/toolHistory.ts). Both a
// success and a failed attempt are recorded; a failed row carries a "Failed"
// badge and its detail dialog shows the error instead of a content preview.
export function ToolHistoryList({
  tool,
  onReuse,
  renderPreview,
}: {
  tool: ToolHistoryTool;
  onReuse: (inputs: Record<string, unknown>) => void;
  // Only ever called for a succeeded entry — a failed one has no result to
  // preview, so its detail dialog shows the error message instead.
  renderPreview: (entry: Extract<ToolHistoryEntry, { status: "succeeded" }>) => ReactNode;
}) {
  const { entries, remove, rename } = useToolHistory(tool);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [detailEntry, setDetailEntry] = useState<ToolHistoryEntry | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<ToolHistoryEntry | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const visible = entries.slice(0, PREVIEW_COUNT);

  const startRename = (entry: ToolHistoryEntry) => {
    setRenamingEntry(entry);
    setRenameDraft(entry.summary);
  };
  const saveRename = () => {
    const text = renameDraft.trim();
    if (renamingEntry && text) rename({ id: renamingEntry.id, summary: text });
    setRenamingEntry(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Recent History</SectionTitle>
        {entries.length > PREVIEW_COUNT && (
          <button
            type="button"
            onClick={() => setViewAllOpen(true)}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            View all ({entries.length})
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing generated yet — your results will show up here.
        </p>
      ) : (
        <HistoryTable
          entries={visible}
          onOpen={setDetailEntry}
          onReuse={onReuse}
          onRemove={remove}
          onRename={startRename}
        />
      )}

      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="flex max-h-[80vh] max-w-lg flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Recent History</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <HistoryTable
              entries={entries}
              onOpen={setDetailEntry}
              onReuse={onReuse}
              onRemove={remove}
              onRename={startRename}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="min-w-0 truncate">{detailEntry?.summary}</DialogTitle>
          </DialogHeader>
          {detailEntry &&
            (detailEntry.status === "failed" ? (
              <p className="text-[12.5px] leading-relaxed text-red-600">{detailEntry.errorMessage}</p>
            ) : detailEntry.status === "pending" ? (
              <p className="flex items-center gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Still processing…
              </p>
            ) : (
              renderPreview(detailEntry)
            ))}
        </DialogContent>
      </Dialog>

      <Dialog open={renamingEntry !== null} onOpenChange={(open) => !open && setRenamingEntry(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
            }}
          />
          <DialogFooter>
            <Button onClick={saveRename} disabled={!renameDraft.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
