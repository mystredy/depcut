"use client";

import { GradientButton, Eyebrow } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { GRADIENT_TEXT } from "@/app/cut/_components/landing/dark/theme";
import { useAppEntryHref } from "@/app/_components/landing/useAppEntryHref";
import { EditorMock } from "@/cut/components/editor-mock/EditorMock";

export function CutHero() {
  const appHref = useAppEntryHref();

  return (
    <section id="top" className="relative mx-auto max-w-[1400px] px-6 pt-16 pb-20 md:px-12 md:pt-20 md:pb-28">
      {/* Ambient glow behind the headline — the page's one big light source,
          everything else stays subtle so this reads first. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[560px] w-[900px] -translate-x-1/2 opacity-40"
        style={{
          background:
            "radial-gradient(closest-side, rgba(139,92,246,0.35), rgba(59,130,246,0.18) 45%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="flex flex-col items-center text-center">
        <Eyebrow>AI video editor</Eyebrow>
        <h1 className="mt-6 max-w-[900px] text-[clamp(40px,6.5vw,76px)] font-semibold leading-[1.02] tracking-[-0.02em] text-white">
          The video editor{" "}
          <span style={GRADIENT_TEXT}>iMovie should have been.</span>
        </h1>
        <p className="mt-6 max-w-[640px] text-[17px] leading-[1.6] text-white/60">
          A browser editor with AI generation when needed. The companion Mac
          app transcribes, stores, and exports using your own hardware — no
          uploads, no cloud storage fees, and it works with your Claude or
          Codex subscription.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <GradientButton href={appHref("/app")} variant="gradient" size="lg">
            Start a new project
          </GradientButton>
          <GradientButton href="#features" variant="ghost" size="lg">
            See what it does
          </GradientButton>
        </div>
      </div>

      <div className="relative mt-16 md:mt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] opacity-60 md:-inset-10"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 40%, rgba(139,92,246,0.25), transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="mx-auto max-w-[1100px] overflow-hidden rounded-3xl p-1"
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            background:
              "linear-gradient(160deg, rgba(139,92,246,0.25), rgba(255,255,255,0.03) 40%, rgba(236,72,153,0.12))",
            boxShadow: "0 40px 100px rgba(0,0,0,0.55)",
          }}
        >
          <div className="overflow-hidden rounded-[20px]">
            <EditorMock />
          </div>
        </div>
      </div>
    </section>
  );
}
