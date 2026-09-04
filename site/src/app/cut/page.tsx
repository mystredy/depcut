import type { Metadata } from "next";

import { CutLanding } from "@/app/cut/_components/landing/CutLanding";
import { DEPCUT_CANONICAL } from "@/cut/lib/hosts";

export const metadata: Metadata = {
  title: "DepCut — the AI video editor on your Mac",
  description:
    "Cut video with AI on your own Mac. Generate images, clips, voiceover, and music in the timeline; every edit and export renders locally.",
  alternates: { canonical: `${DEPCUT_CANONICAL}/` },
  openGraph: {
    title: "DepCut — the AI video editor on your Mac",
    description:
      "Cut video with AI on your own Mac. Generation in the timeline, editing and export fully local.",
    url: `${DEPCUT_CANONICAL}/`,
    siteName: "DepCut",
    type: "website",
    images: [{ url: "/cut/landing/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DepCut — the AI video editor on your Mac",
    description:
      "Cut video with AI on your own Mac. Generation in the timeline, editing and export fully local.",
    images: ["/cut/landing/og.png"],
  },
};

// The Cut marketing landing, served at "/" on every host by the proxy's
// "/…" → "/cut/…" rewrite.
export default function CutLandingPage() {
  return <CutLanding />;
}
