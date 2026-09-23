import type { ReactNode } from "react";

import { CutFooter } from "@/app/cut/_components/landing/CutFooter";
import { CutTopNav } from "@/app/cut/_components/landing/CutTopNav";
import { BG, TEXT } from "@/app/cut/_components/landing/dark/theme";

// The dark-landing page shell shared by /blog, /blog/[slug], and
// /blog/category/[slug] — was duplicated inline on the first two before this.
export function BlogShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: BG,
        color: TEXT,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        overflowX: "hidden",
      }}
    >
      <style>{`html, body { background: ${BG}; overflow-x: hidden; }`}</style>
      <CutTopNav />
      {children}
      <CutFooter />
    </main>
  );
}
