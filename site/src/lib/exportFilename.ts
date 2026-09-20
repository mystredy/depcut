// A safe base filename from arbitrary text (a script, a prompt, a topic) —
// shared by the server (building a download URL's filename) and the client
// (naming an exported file), so the two agree on what a row is called.
export function safeExportName(text: string): string {
  return text.trim().replace(/[^\p{L}\p{N} -]+/gu, "").trim().slice(0, 60) || "export";
}
