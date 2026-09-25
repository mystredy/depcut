"use client";

import { useEffect } from "react";

// The signed-in /app surface renders on white, but the root html/body default to
// the cream landing background — which shows through in the browser overscroll
// area above the content. While the app is mounted we flag the html element so a
// scoped rule in globals.css paints it (and the overscroll) white instead.
export function AppSurfaceBackground() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("app-surface");
    return () => root.classList.remove("app-surface");
  }, []);

  return null;
}

const APP_SURFACE_PREFIXES = ["/app", "/admin", "/s", "/depcutvision/settings"];

const underPath = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

// Every route whose own layout mounts AppSurfaceBackground above — used by the
// root error boundary (src/app/error.tsx), which has no layout of its own and
// so can't rely on one of those already having flagged the html element: a
// stale chunk failing to load can throw before any of those layouts (and the
// AppSurfaceBackground they mount) ever render, which unwinds the error past
// them straight to the root boundary.
export function isAppSurfacePath(pathname: string): boolean {
  return APP_SURFACE_PREFIXES.some((prefix) => underPath(pathname, prefix));
}
