"use client";

import { GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { GRADIENT } from "@/app/cut/_components/landing/dark/theme";
import { useAppEntryHref } from "@/app/_components/landing/useAppEntryHref";

export function CutFinalCTA() {
  const appHref = useAppEntryHref();

  return (
    <section id="download" className="mx-auto w-full max-w-[1400px] px-6 pt-8 pb-24 md:px-12 md:pb-32">
      <div className="relative rounded-3xl p-px" style={{ background: GRADIENT }}>
        <div
          className="relative overflow-hidden rounded-[calc(1.5rem-1px)] px-6 py-16 text-center md:px-12 md:py-24"
          style={{ background: "#08070C" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[420px] w-[700px] -translate-x-1/2 -translate-y-1/2 opacity-50"
            style={{
              background:
                "radial-gradient(closest-side, rgba(139,92,246,0.4), rgba(236,72,153,0.15) 55%, transparent 75%)",
              filter: "blur(70px)",
            }}
          />
          <div className="relative">
            <h2 className="text-[clamp(32px,5.5vw,56px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
              Cut your next video
              <br />
              on your Mac.
            </h2>
            <div className="mt-9 flex justify-center">
              <GradientButton href={appHref("/app")} variant="gradient" size="lg">
                Start Today
              </GradientButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
