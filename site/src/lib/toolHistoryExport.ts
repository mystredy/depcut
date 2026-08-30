"use client";

import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";
import type { ToolHistoryEntry } from "@/lib/toolHistory";

type SucceededEntry = Extract<ToolHistoryEntry, { status: "succeeded" }>;

/** A safe base filename from a history row's summary — used for every
 * export format, with just the extension varying. */
export function safeExportName(summary: string): string {
  return summary.trim().replace(/[^\p{L}\p{N} -]+/gu, "").trim().slice(0, 60) || "export";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadText(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename);
}

export function exportAsTxt(text: string, name: string) {
  downloadText(text, `${name}.txt`, "text/plain");
}

export function exportAsJson(entry: SucceededEntry, name: string) {
  const text = entry.result.kind === "text" ? entry.result.text : undefined;
  downloadText(
    JSON.stringify({ inputs: entry.inputs, summary: entry.summary, text }, null, 2),
    `${name}.json`,
    "application/json",
  );
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportAsHtml(text: string, title: string, name: string) {
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body><pre style="white-space:pre-wrap;font-family:system-ui,sans-serif">${escapeHtml(text)}</pre></body>
</html>`;
  downloadText(html, `${name}.html`, "text/html");
}

export function exportAsPdf(text: string, name: string) {
  const doc = new jsPDF({ unit: "pt" });
  const margin = 40;
  const maxWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineHeight = 16;
  let y = margin;
  for (const line of doc.splitTextToSize(text, maxWidth) as string[]) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }
  doc.save(`${name}.pdf`);
}

export async function exportAsDocx(text: string, name: string) {
  const doc = new Document({
    sections: [{ children: text.split("\n").map((line) => new Paragraph(line)) }],
  });
  downloadBlob(await Packer.toBlob(doc), `${name}.docx`);
}

/** Whether this browser's Clipboard API can hold this entry's result —
 * plain text always, an image blob where ClipboardItem supports its type. */
export function canCopyEntry(entry: SucceededEntry): boolean {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  if (entry.result.kind === "text") return true;
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports(entry.result.mimeType)
  );
}

export async function copyEntryToClipboard(entry: SucceededEntry): Promise<void> {
  if (entry.result.kind === "text") {
    await navigator.clipboard.writeText(entry.result.text);
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ [entry.result.mimeType]: entry.result.blob })]);
}

function entryAsFile(entry: SucceededEntry, name: string): File | null {
  if (entry.result.kind !== "blob") return null;
  return new File([entry.result.blob], entry.result.filename || name, { type: entry.result.mimeType });
}

/** Whether the Web Share API can share this entry — there's no server-side
 * link to hand off (history never leaves the browser), so this is the only
 * "Share" available: the OS share sheet, handing the content straight to
 * another app. */
export function canShareEntry(entry: SucceededEntry, name: string): boolean {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  if (entry.result.kind === "text") return true;
  const file = entryAsFile(entry, name);
  if (!file) return false;
  return typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] });
}

export async function shareEntry(entry: SucceededEntry, title: string, name: string): Promise<void> {
  try {
    if (entry.result.kind === "text") {
      await navigator.share({ text: entry.result.text, title });
      return;
    }
    const file = entryAsFile(entry, name);
    await navigator.share(file ? { files: [file], title } : { title });
  } catch (e) {
    // The user dismissed the OS share sheet without picking a target — normal,
    // not a failure worth surfacing or reporting.
    if (e instanceof DOMException && e.name === "AbortError") return;
    throw e;
  }
}
