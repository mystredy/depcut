import { NextResponse } from "next/server";

import type { CandidatePage } from "@/lib/marketplace/oauth-page-state";

// Tiny self-contained pages rendered inside the OAuth popup window — no
// layout/CSS dependency since this window never shows the app shell.
export function oauthPopupHtml(opts: { title: string; message: string; success: boolean }) {
  const color = opts.success ? "#059669" : "#dc2626";
  const script = opts.success
    ? `try { window.opener && window.opener.postMessage({ type: "social-connection-added" }, window.location.origin); } catch (e) {}
       setTimeout(() => window.close(), 1200);`
    : "";
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${opts.title}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5;">
  <div style="text-align:center;max-width:320px;padding:24px;">
    <p style="color:${color};font-weight:600;font-size:15px;margin:0 0 8px;">${opts.title}</p>
    <p style="font-size:13px;color:#a3a3a3;margin:0;">${opts.message}</p>
    <button onclick="window.close()" style="margin-top:16px;padding:6px 14px;border-radius:8px;border:1px solid #333;background:transparent;color:#e5e5e5;cursor:pointer;">Close</button>
  </div>
  <script>${script}</script>
</body></html>`,
    { headers: { "Content-Type": "text/html" }, status: opts.success ? 200 : 400 },
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// The Facebook/Instagram "which Page do you want to connect" step, shown
// only when the connected user manages more than one candidate — a single
// candidate is auto-selected without this screen. Each option is a plain
// link (not a form) since the choice itself is the only input needed; the
// signed state carrying the candidates' Page access tokens travels in the
// query string, verified server-side by /select-page.
export function oauthPagePickerHtml(opts: { title: string; pages: CandidatePage[]; selectUrl: string; state: string }) {
  const options = opts.pages
    .map(
      (page) => `
    <a href="${opts.selectUrl}?state=${encodeURIComponent(opts.state)}&pageId=${encodeURIComponent(page.id)}"
       style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #333;border-radius:10px;margin-bottom:8px;text-decoration:none;color:#e5e5e5;">
      ${page.profileImage ? `<img src="${escapeHtml(page.profileImage)}" alt="" style="width:28px;height:28px;border-radius:999px;object-fit:cover;">` : ""}
      <span>${escapeHtml(page.name)}</span>
    </a>`,
    )
    .join("");

  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(opts.title)}</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0a0a0a;color:#e5e5e5;">
  <div style="width:100%;max-width:360px;padding:24px;">
    <p style="font-weight:600;font-size:15px;margin:0 0 16px;">${escapeHtml(opts.title)}</p>
    ${options}
  </div>
</body></html>`,
    { headers: { "Content-Type": "text/html" }, status: 200 },
  );
}
