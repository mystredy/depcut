// The dark, gradient-accented visual system for the Cut marketing landing
// only — kept fully separate from `_components/landing/theme.ts` (the cream
// system), which DepCut Vision, the auth screens, and the legal pages still
// use. Nothing here is imported outside `cut/_components/landing`.
import type { CSSProperties } from "react";

export const BG = "#08070C"; // page background
export const SURFACE = "#111018"; // card fill
export const SURFACE_SOFT = "#15131E"; // slightly lighter card fill, for contrast against SURFACE
export const BORDER = "rgba(255,255,255,0.09)";
export const BORDER_STRONG = "rgba(255,255,255,0.16)";

export const TEXT = "#F4F3F7";
export const TEXT_MUTED = "rgba(244,243,247,0.62)";
export const TEXT_FAINT = "rgba(244,243,247,0.4)";

// The three-stop gradient reused across headlines, button fills, glows, and
// borders — violet -> blue -> pink, the family most AI-generation tools
// (this page's own reference points included) converge on right now.
export const VIOLET = "#8B5CF6";
export const BLUE = "#3B82F6";
export const PINK = "#EC4899";

export const GRADIENT = `linear-gradient(90deg, ${VIOLET}, ${BLUE} 55%, ${PINK})`;
export const GRADIENT_TEXT: CSSProperties = {
  backgroundImage: GRADIENT,
  backgroundClip: "text",
  WebkitBackgroundClip: "text",
  color: "transparent",
};

// Card accent tints — each feature/pricing tile picks one so the grid reads
// as a set without every tile looking identical.
export const TINTS = {
  violet: { fg: VIOLET, glow: "rgba(139,92,246,0.35)" },
  blue: { fg: BLUE, glow: "rgba(59,130,246,0.35)" },
  pink: { fg: PINK, glow: "rgba(236,72,153,0.35)" },
  mint: { fg: "#34D399", glow: "rgba(52,211,153,0.32)" },
  amber: { fg: "#FBBF24", glow: "rgba(251,191,36,0.3)" },
} as const;

export type Tint = keyof typeof TINTS;
