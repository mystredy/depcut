import { NextResponse } from "next/server";

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
