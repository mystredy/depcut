import type { ReactNode } from "react";

import { CutFooter } from "@/app/cut/_components/landing/CutFooter";
import { CutTopNav } from "@/app/cut/_components/landing/CutTopNav";
import { BG, TEXT } from "@/app/cut/_components/landing/dark/theme";

type Props = {
  children: ReactNode;
};

export function LegalPageShell({ children }: Props) {
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
      {/* Same html/body override + overflow guard as the Cut landing page
          (CutLanding.tsx) — see its comment for why both are needed. */}
      <style>{`html, body { background: ${BG}; overflow-x: hidden; }`}</style>
      <CutTopNav />
      <section className="mx-auto box-border w-full max-w-5xl px-6 py-12 md:px-10 md:py-20">
        <article className="prose prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-normal prose-h1:text-5xl prose-h1:leading-none prose-h2:mt-12 prose-h2:border-t prose-h2:border-white/15 prose-h2:pt-8 prose-a:font-semibold prose-a:text-white prose-strong:text-white prose-p:text-white/70 prose-li:text-white/70 md:prose-h1:text-7xl">
          {children}
        </article>
      </section>
      <CutFooter />
    </main>
  );
}
