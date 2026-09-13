"use client";

import type { CardColor } from "@/app/_components/landing/theme";
import { Headline, TapedCard } from "@/app/_components/landing/LandingPrimitives";

type Feature = {
  title: string;
  body: string;
  color: CardColor;
  tapeColor: CardColor;
  tapePosition: "left" | "right" | "center";
};

const FEATURES: Feature[] = [
  {
    title: "A real timeline editor",
    body: "Multi-track video and audio, transitions, titles, color grading, stickers, and subtitles — everything a real edit needs, not a stripped-down version of it.",
    color: "blue",
    tapeColor: "coral",
    tapePosition: "left",
  },
  {
    title: "An AI that edits with you",
    body: "Ask for a cut, a caption, or a whole scene. It generates video, images, voiceover, and music straight into your timeline — and can watch or listen to your footage first.",
    color: "yellow",
    tapeColor: "blue",
    tapePosition: "center",
  },
  {
    title: "Extend any clip",
    body: "Shot ran a beat too short? AI Extend continues it — same shot, more seconds, no reshoot.",
    color: "mint",
    tapeColor: "pink",
    tapePosition: "right",
  },
  {
    title: "A full AI Suite",
    body: "Text-to-Video, Text-to-Image, Image-to-Video, Text-to-Speech, Speech-to-Text, Dubbing, and Scripting — standalone tools, or called from inside the editor.",
    color: "pink",
    tapeColor: "yellow",
    tapePosition: "left",
  },
  {
    title: "Your own Studio",
    body: "A creator profile with Drops, managers, and an activity log — built into DepCut, not a separate app you have to sign up for.",
    color: "purple",
    tapeColor: "mint",
    tapePosition: "center",
  },
  {
    title: "Publish everywhere",
    body: "One click to YouTube, TikTok, X, Instagram, Threads, and Facebook Pages. Cut once, post to all of them.",
    color: "coral",
    tapeColor: "purple",
    tapePosition: "right",
  },
];

export function CutFeatures() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-24">
      <Headline size="lg">
        One editor. <span className="italic">Everything else too.</span>
      </Headline>
      <p className="mt-6 max-w-[720px] text-[17px] leading-[1.55] text-[#454545]">
        A full timeline editor, an AI that generates and edits alongside you,
        and a place to publish when you&apos;re done — DepCut is the whole
        pipeline, not just the cutting room.
      </p>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <TapedCard
            key={feature.title}
            fill
            color={feature.color}
            tapeColor={feature.tapeColor}
            tapePosition={feature.tapePosition}
          >
            <div className="p-6 md:p-7">
              <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-ink">
                {feature.title}
              </h3>
              <p className="mt-3 text-[15px] leading-[1.5] text-ink/70">
                {feature.body}
              </p>
            </div>
          </TapedCard>
        ))}
      </div>
    </section>
  );
}
