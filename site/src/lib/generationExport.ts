"use client";

import { Document, Packer, Paragraph } from "docx";
import { jsPDF } from "jspdf";

export { safeExportName } from "@/lib/exportFilename";

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

export function exportAsJson(data: Record<string, unknown>, name: string) {
  downloadText(JSON.stringify(data, null, 2), `${name}.json`, "application/json");
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

export function canCopyText(): boolean {
  return typeof navigator !== "undefined" && !!navigator.clipboard;
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

export function canShareText(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

/** The OS share sheet, handing plain text straight to another app — there's
 * no server-side link to share, this row's content is the whole of it. */
export async function shareText(text: string, title: string): Promise<void> {
  try {
    await navigator.share({ text, title });
  } catch (e) {
    // The user dismissed the OS share sheet without picking a target —
    // normal, not a failure worth surfacing or reporting.
    if (e instanceof DOMException && e.name === "AbortError") return;
    throw e;
  }
}

export function canShareMedia(): boolean {
  return typeof navigator !== "undefined" && !!navigator.share;
}

/** Same idea for a media row: fetches its (inline-disposition) preview URL
 * into a blob and hands that to the OS share sheet as a file. Falls back to
 * sharing the link itself if the browser won't share this file type. */
export async function shareMediaUrl(url: string, filename: string, mime: string, title: string): Promise<void> {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const file = new File([blob], filename, { type: mime });
    if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
      await navigator.share({ title, url });
      return;
    }
    await navigator.share({ files: [file], title });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return;
    throw e;
  }
}

/** Navigates to a download URL whose response itself carries
 * Content-Disposition: attachment (see r2.ts's presignGetDownload) — no
 * `download` attribute needed, the server dictates it. */
export function downloadFromUrl(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
