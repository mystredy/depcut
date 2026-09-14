"use client";

import { Eyebrow, GlassCard, GradientButton } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { GITHUB_REPO_URL } from "@/app/_components/landing/data";

export function CutOpenSource() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
      <div className="flex flex-col items-center text-center">
        <Eyebrow>Open source</Eyebrow>
        <h2 className="mt-6 text-[clamp(30px,4.5vw,48px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
          DepCut is open source.
        </h2>
        <p className="mt-5 max-w-[560px] text-[17px] leading-[1.6] text-white/60">
          The editor and its render engine are built in the open. Read the
          source, run it yourself, contribute and make it better.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-[760px]">
        <GlassCard tint="violet">
          <div className="p-6 md:p-8">
            <div className="overflow-x-auto rounded-xl bg-black/40 px-[18px] py-5 font-code text-[13px] text-white md:p-6 md:text-[15px]">
              <div className="mb-4 flex items-center gap-2 text-[#888]">
                <span className="h-[10px] w-[10px] rounded-full bg-[#FF5F57]" />
                <span className="h-[10px] w-[10px] rounded-full bg-[#FEBC2E]" />
                <span className="h-[10px] w-[10px] rounded-full bg-[#28C840]" />
                <span className="ml-2 text-xs">~/ - DepCutUseCorp/DepCut</span>
              </div>
              <div className="whitespace-nowrap text-[#b7b7b7]">
                <span className="text-[#5FFFB9]">$</span> git clone {GITHUB_REPO_URL}
              </div>
              <div className="mt-3 text-[#6f6f6f]"># Run the editor locally</div>
              <div className="mt-1 whitespace-nowrap text-[#b7b7b7]">
                <span className="text-[#5FFFB9]">$</span> cd DepCut/site && npm install && npm run dev
              </div>
              <div className="mt-3 text-[#5FFFB9]">Editor running - http://localhost:3000/cut</div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <GradientButton href={GITHUB_REPO_URL} variant="ghost" size="md">
                Star on GitHub
              </GradientButton>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
