"use client";

import { Clipboard, Download, EllipsisVertical, RotateCcw, Share2, Trash2 } from "lucide-react";

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
import {
  canCopyText,
  canShareText,
  copyText,
  exportAsDocx,
  exportAsHtml,
  exportAsJson,
  exportAsPdf,
  exportAsTxt,
  safeExportName,
  shareText,
} from "@/lib/generationExport";

// The per-row "..." menu shared by every text-result Generations list
// (Transcription, Scripting) — a succeeded row offers Quick export (five
// formats), Copy, and Share on top of its content; a failed one has only
// Use again and Delete, since there's no text to act on.
export function TextGenerationRowMenu({
  text,
  title,
  data,
  onUseAgain,
  onDelete,
}: {
  text: string | null;
  title: string;
  data: Record<string, unknown>;
  onUseAgain?: () => void;
  onDelete: () => void;
}) {
  const name = safeExportName(title);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <EllipsisVertical className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {text && (
          <>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Download /> Quick export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => exportAsTxt(text, name)}>Text</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsPdf(text, name)}>PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportAsDocx(text, name)}>DOCX</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsHtml(text, title, name)}>HTML</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportAsJson({ ...data, text }, name)}>JSON</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {canCopyText() && (
              <DropdownMenuItem onClick={() => void copyText(text)}>
                <Clipboard /> Copy to clipboard
              </DropdownMenuItem>
            )}
            {canShareText() && (
              <DropdownMenuItem onClick={() => void shareText(text, title).catch(() => {})}>
                <Share2 /> Share
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        {onUseAgain && (
          <DropdownMenuItem onClick={onUseAgain}>
            <RotateCcw /> Use again
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
