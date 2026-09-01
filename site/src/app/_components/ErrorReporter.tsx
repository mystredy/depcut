"use client";

import { useEffect } from "react";

import { reportSiteError } from "@/lib/reportSiteError";

// Chrome and Safari surface this through window.onerror whenever a
// ResizeObserver callback can't finish delivering every notification within
// one frame — routine under the browser's own throttling, never a sign
// anything actually broke, and noisy enough (it fires from third-party
// layout code too) that every major error tracker ignores it by default.
const isResizeObserverNoise = (message: string) => message.startsWith("ResizeObserver loop");

// Catches JS errors and unhandled promise rejections outside React's render
// tree (a render crash itself is caught by error.tsx boundaries instead) —
// a bug in a plain event handler, a canvas/WebGL callback, a stray
// unguarded fetch — so it still reaches the admin's Telegram even though
// nothing on screen necessarily shows it broke.
export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isResizeObserverNoise(event.message)) return;
      reportSiteError("window.onerror", event.error ?? event.message);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      reportSiteError("unhandledrejection", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
