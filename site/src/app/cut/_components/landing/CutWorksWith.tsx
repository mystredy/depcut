"use client";

import { Eyebrow } from "@/app/cut/_components/landing/dark/DarkPrimitives";

// The assistant rides the Claude and Codex logins already on the user's Mac,
// so a subscription is all it takes — this section says exactly that.
// OpenAI's mark ships with no explicit fill (defaults to black), so it's
// inverted to white to read on this dark background; Claude's already
// carries its own brand color and needs nothing.
const PROVIDERS = [
  { name: "Claude", logo: "/cut/landing/claude-logo.svg", invert: false },
  { name: "Codex", logo: "/cut/landing/openai-logo.svg", invert: true },
];

export function CutWorksWith() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-16 text-center md:px-12 md:py-20">
      <Eyebrow>Works with</Eyebrow>
      <div className="mt-10 flex items-center justify-center gap-x-10 md:gap-x-20">
        {PROVIDERS.map((provider) => (
          <div key={provider.name} className="flex items-center gap-2.5 md:gap-3.5">
            <img
              src={provider.logo}
              alt=""
              className="size-8 md:size-10"
              style={provider.invert ? { filter: "invert(1)" } : undefined}
            />
            <span className="text-[clamp(18px,4vw,32px)] font-semibold tracking-tight text-white">
              {provider.name}
            </span>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[600px] text-[15px] leading-[1.6] text-white/55">
        The assistant uses the Claude and Codex apps already signed in on your
        Mac. If you have a subscription, you&apos;re done — no setup, no API
        keys.
      </p>
    </section>
  );
}
