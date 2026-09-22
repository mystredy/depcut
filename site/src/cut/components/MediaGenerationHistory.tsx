"use client";

import { useState } from "react";
import {
  AudioLines,
  Check,
  Copy,
  Download,
  EllipsisVertical,
  ImagePlus,
  LibraryBig,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AudioPlayer } from "@/cut/components/AudioPlayer";
import { SectionTitle } from "@/cut/components/SectionTitle";
import { accentFor } from "@/cut/lib/colorAccent";
import { canShareMedia, downloadFromUrl, shareMediaUrl } from "@/lib/generationExport";
import { cn } from "@/lib/utils";
import { useDeleteGeneration, useGenerationHistory } from "@/queries/generationHistory";

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type MediaHistoryRow = {
  id: string;
  createdAt: string;
  outputUrl: string | null;
  downloadUrl: string | null;
  outputMime: string | null;
  status?: string;
  errorMessage?: string | null;
};

function RowMenu<T extends MediaHistoryRow>({
  entry,
  label,
  onUseAsReference,
  onUseAgain,
  onAddToLibrary,
  onDelete,
}: {
  entry: T;
  label: string;
  onUseAsReference?: (row: T) => void;
  onUseAgain?: (row: T) => void;
  // Uploads the row's media into the account Library — omitted where a tool
  // has nowhere else to land it (its generations are already the record).
  onAddToLibrary?: (row: T) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasMedia = entry.status !== "failed" && !!entry.outputUrl && !!entry.downloadUrl;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <EllipsisVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem
          onClick={() => {
            void navigator.clipboard.writeText(label).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check className="text-emerald-600" /> : <Copy />}
          {copied ? "Copied" : "Copy prompt"}
        </DropdownMenuItem>
        {hasMedia && (
          <>
            <DropdownMenuItem onClick={() => downloadFromUrl(entry.downloadUrl!)}>
              <Download /> Download
            </DropdownMenuItem>
            {canShareMedia() && (
              <DropdownMenuItem
                onClick={() =>
                  void shareMediaUrl(entry.outputUrl!, label, entry.outputMime ?? "", label).catch(() => {})
                }
              >
                <Share2 /> Share
              </DropdownMenuItem>
            )}
            {onUseAsReference && (
              <DropdownMenuItem onClick={() => onUseAsReference(entry)}>
                <ImagePlus /> Use as reference
              </DropdownMenuItem>
            )}
            {onAddToLibrary && (
              <DropdownMenuItem onClick={() => onAddToLibrary(entry)}>
                <LibraryBig /> Add to library
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        {onUseAgain && (
          <DropdownMenuItem onClick={() => onUseAgain(entry)}>
            <RotateCcw /> Reuse
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// The shared server-saved history view for every media-producing AI Suite
// tool (Text to Speech, Dubbing, Text to Image, Text to Video) — each has
// its own DB table and R2-backed media, so only the row shape and preview
// kind differ; see generationHistory.ts for the shared query/delete hooks.
export function MediaGenerationHistory<T extends MediaHistoryRow>({
  basePath,
  listKey,
  kind,
  label,
  emptyMessage,
  onUseAsReference,
  onUseAgain,
  onAddToLibrary,
  variant = "table",
  subtitle,
}: {
  basePath: string;
  listKey: string;
  kind: "audio" | "image" | "video";
  label: (row: T) => string;
  emptyMessage: string;
  // Image/video only: attach a past generation as a reference for the next
  // one — the caller owns turning outputUrl into an AssetRef (see
  // TextToImagePage's attachHistoryEntryAsReference), this just offers the
  // menu item and passes the row back.
  onUseAsReference?: (row: T) => void;
  // Refill the form from a past run's own stored fields — omitted where a
  // tool has nothing reusable to restore.
  onUseAgain?: (row: T) => void;
  // Uploads the row's media into the account Library — the caller owns
  // fetching the bytes and calling uploadToLibrary; omitted where that
  // doesn't apply.
  onAddToLibrary?: (row: T) => void;
  // "audio-card" trades the plain table for a card per generation with an
  // inline waveform player (AudioPlayer) — built for Text to Speech, where a
  // row's whole point is a clip worth previewing in place, not a plain link.
  variant?: "table" | "audio-card";
  // audio-card only: one extra line under the title (Text to Speech shows the
  // voice used).
  subtitle?: (row: T) => string;
}) {
  const history = useGenerationHistory<T>(basePath, listKey);
  const del = useDeleteGeneration(basePath);
  const [detailEntry, setDetailEntry] = useState<T | null>(null);

  return (
    <div className="space-y-3">
      <SectionTitle>Generations</SectionTitle>

      {history.isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      ) : history.isError ? (
        <p className="text-xs text-destructive">Couldn&apos;t load your saved generations.</p>
      ) : !history.data || history.data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      ) : variant === "audio-card" ? (
        <div className="space-y-2.5">
          {history.data.map((entry) => {
            const accent = accentFor(entry.id);
            return (
            <div key={entry.id} className="rounded-xl border bg-muted/20 p-3">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white",
                    accent,
                  )}
                >
                  <AudioLines className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-semibold">{label(entry)}</p>
                    <RowMenu
                      entry={entry}
                      label={label(entry)}
                      onUseAgain={onUseAgain}
                      onAddToLibrary={onAddToLibrary}
                      onDelete={() => del.mutate(entry.id)}
                    />
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {timeAgo(entry.createdAt)}
                    {subtitle && ` · ${subtitle(entry)}`}
                  </p>
                </div>
              </div>
              <div className="mt-2.5">
                {entry.status === "failed" ? (
                  <p className="text-[11px] leading-relaxed text-destructive">
                    {entry.errorMessage ?? "Generation failed."}
                  </p>
                ) : entry.outputUrl ? (
                  <AudioPlayer src={entry.outputUrl} accent={accent} />
                ) : (
                  <p className="text-[11px] text-muted-foreground">No media saved for this run.</p>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Prompt</TableHead>
              <TableHead className="w-32 text-right">Saved</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((entry) => (
              <TableRow key={entry.id} className="cursor-pointer" onClick={() => setDetailEntry(entry)}>
                <TableCell className="truncate text-xs font-medium">{label(entry)}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    {entry.status === "failed" && <Badge variant="destructive">Failed</Badge>}
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(entry.createdAt)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RowMenu
                    entry={entry}
                    label={label(entry)}
                    onUseAsReference={kind === "audio" ? undefined : onUseAsReference}
                    onUseAgain={onUseAgain}
                    onAddToLibrary={onAddToLibrary}
                    onDelete={() => del.mutate(entry.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={detailEntry !== null} onOpenChange={(open) => !open && setDetailEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader className="min-w-0 pr-8">
            <DialogTitle className="min-w-0 truncate">{detailEntry ? label(detailEntry) : ""}</DialogTitle>
          </DialogHeader>
          {detailEntry &&
            (detailEntry.status === "failed" ? (
              <p className="text-[12.5px] leading-relaxed text-red-600">{detailEntry.errorMessage}</p>
            ) : !detailEntry.outputUrl ? (
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">No media saved for this run.</p>
            ) : kind === "audio" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- generated speech, no captions to offer
              <audio controls src={detailEntry.outputUrl} className="w-full" />
            ) : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a presigned R2 URL, not a static/optimizable asset
              <img src={detailEntry.outputUrl} alt="" className="w-full rounded-lg" />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption -- generated video, no captions to offer
              <video controls src={detailEntry.outputUrl} className="max-h-[60vh] w-full rounded-lg" />
            ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
