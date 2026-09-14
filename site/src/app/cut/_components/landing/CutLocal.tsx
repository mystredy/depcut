"use client";

import Image from "next/image";

import { Eyebrow, GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { cutInstallHref } from "@/cut/lib/install";

export function CutLocal() {
  return (
    <section id="local" className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
      <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <Eyebrow>Mac app</Eyebrow>
          <h2 className="mt-6 text-[clamp(30px,4.5vw,48px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
            Run DepCut on your Mac.
          </h2>
          <p className="mt-5 max-w-[480px] text-[17px] leading-[1.6] text-white/60">
            Edit videos locally on your Mac. The app uses your own storage and
            transcribes audio on device.
          </p>
          <div className="mt-8">
            <GradientButton href={cutInstallHref()} variant="gradient" size="lg">
              Download for Mac
            </GradientButton>
          </div>
        </div>
        <div
          className="rounded-3xl p-2"
          style={{ border: "1px solid rgba(255,255,255,0.09)", background: "rgba(255,255,255,0.03)" }}
        >
          <Image
            alt="DepCut app icon being dragged into the Applications folder."
            className="h-auto w-full rounded-2xl"
            height={413}
            src="/install/install-drag.png"
            unoptimized
            width={617}
          />
        </div>
      </div>
    </section>
  );
}
