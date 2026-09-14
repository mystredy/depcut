"use client";

import {
  Clapperboard,
  Layers,
  Scissors,
  Sparkles,
  Store,
  Wand2,
} from "lucide-react";
import type { ComponentType } from "react";

import { Eyebrow, GlassCard } from "@/app/cut/_components/landing/dark/DarkPrimitives";
import { TINTS, type Tint } from "@/app/cut/_components/landing/dark/theme";

type Feature = {
  title: string;
  body: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  tint: Tint;
};

const FEATURES: Feature[] = [
  {
    title: "A real timeline editor",
    body: "Multi-track video and audio, transitions, titles, color grading, stickers, and subtitles — everything a real edit needs, not a stripped-down version of it.",
    icon: Layers,
    tint: "blue",
  },
  {
    title: "An AI that edits with you",
    body: "Ask for a cut, a caption, or a whole scene. It generates video, images, voiceover, and music straight into your timeline — and can watch or listen to your footage first.",
    icon: Sparkles,
    tint: "violet",
  },
  {
    title: "Extend any clip",
    body: "Shot ran a beat too short? AI Extend continues it — same shot, more seconds, no reshoot.",
    icon: Scissors,
    tint: "mint",
  },
  {
    title: "A full AI Suite",
    body: "Text-to-Video, Text-to-Image, Image-to-Video, Text-to-Speech, Speech-to-Text, Dubbing, and Scripting — standalone tools, or called from inside the editor.",
    icon: Wand2,
    tint: "pink",
  },
  {
    title: "Your own Studio",
    body: "A creator profile with Drops, managers, and an activity log — built into DepCut, not a separate app you have to sign up for.",
    icon: Clapperboard,
    tint: "amber",
  },
  {
    title: "Publish everywhere",
    body: "One click to YouTube, TikTok, X, Instagram, Threads, and Facebook Pages. Cut once, post to all of them.",
    icon: Store,
    tint: "blue",
  },
];

export function CutFeatures() {
  return (
    <section id="features" className="mx-auto max-w-[1400px] px-6 py-20 md:px-12 md:py-28">
      <div className="flex flex-col items-center text-center">
        <Eyebrow>What you get</Eyebrow>
        <h2 className="mt-6 max-w-[720px] text-[clamp(32px,4.5vw,52px)] font-semibold leading-[1.05] tracking-[-0.01em] text-white">
          One editor. Everything else too.
        </h2>
        <p className="mt-5 max-w-[640px] text-[17px] leading-[1.6] text-white/60">
          A full timeline editor, an AI that generates and edits alongside
          you, and a place to publish when you&apos;re done — DepCut is the
          whole pipeline, not just the cutting room.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          const color = TINTS[feature.tint];
          return (
            <GlassCard key={feature.title} fill tint={feature.tint}>
              <div className="flex h-full flex-col p-7">
                <div
                  className="flex size-11 items-center justify-center rounded-xl"
                  style={{ background: `${color.fg}1F`, color: color.fg }}
                >
                  <Icon size={20} />
                </div>
                <h3 className="mt-5 text-[18px] font-semibold tracking-[-0.01em] text-white">
                  {feature.title}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.55] text-white/55">
                  {feature.body}
                </p>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
