import type { BlogThemeId } from "@/lib/blog/themes";

import { THEME_FONTS } from "./fonts";

/** A theme's colors/fonts, shared by the post grid (/blog) and the single
 * post page (/blog/[slug]) so the two always match. "mode" picks prose-invert
 * vs prose for the markdown body and decides whether the post page needs its
 * own full-bleed background (light themes) or can sit on BlogShell's own
 * dark one (glass, nightdesk, terminal). */
export type BlogThemeLook = {
  mode: "light" | "dark";
  background: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  headlineFont: string;
  bodyFont: string;
};

export const BLOG_THEME_LOOKS: Record<BlogThemeId, BlogThemeLook> = {
  glass: {
    mode: "dark",
    background: "#08070C",
    text: "#F4F3F7",
    muted: "rgba(244,243,247,0.62)",
    border: "rgba(255,255,255,0.15)",
    accent: "#8B5CF6",
    headlineFont: THEME_FONTS.glass.headline,
    bodyFont: THEME_FONTS.glass.body,
  },
  ledger: {
    mode: "light",
    background: "#F7F5EF",
    text: "#14110F",
    muted: "#6B6558",
    border: "#DDD8CB",
    accent: "#8A6A2F",
    headlineFont: THEME_FONTS.ledger.headline,
    bodyFont: THEME_FONTS.ledger.body,
  },
  bulletin: {
    mode: "light",
    background: "#FFFFFF",
    text: "#16130F",
    muted: "#6B6558",
    border: "#E5E1D6",
    accent: "#FF5A36",
    headlineFont: THEME_FONTS.bulletin.headline,
    bodyFont: THEME_FONTS.bulletin.body,
  },
  quietPaper: {
    mode: "light",
    background: "#F6F2E9",
    text: "#241F19",
    muted: "#5C5548",
    border: "#DED6C2",
    accent: "#B5613B",
    headlineFont: THEME_FONTS.quietPaper.headline,
    bodyFont: THEME_FONTS.quietPaper.body,
  },
  nightdesk: {
    mode: "dark",
    background: "#0B0C0F",
    text: "#F2F1EC",
    muted: "#8B8A83",
    border: "rgba(255,255,255,0.1)",
    accent: "#7C8CFF",
    headlineFont: THEME_FONTS.nightdesk.headline,
    bodyFont: THEME_FONTS.nightdesk.body,
  },
  deck: {
    mode: "light",
    background: "#FBFAF8",
    text: "#16130F",
    muted: "#6B6558",
    border: "#EFECE4",
    accent: "#3B6EF6",
    headlineFont: THEME_FONTS.deck.headline,
    bodyFont: THEME_FONTS.deck.body,
  },
  digest: {
    mode: "light",
    background: "#FAF8F3",
    text: "#1B1812",
    muted: "#6B6558",
    border: "#E8E3D6",
    accent: "#C9542C",
    headlineFont: THEME_FONTS.digest.headline,
    bodyFont: THEME_FONTS.digest.body,
  },
  broadsheet: {
    mode: "light",
    background: "#FCFBF8",
    text: "#14110F",
    muted: "#6B6558",
    border: "#DDD8CB",
    accent: "#B3261E",
    headlineFont: THEME_FONTS.broadsheet.headline,
    bodyFont: THEME_FONTS.broadsheet.body,
  },
  terminal: {
    mode: "dark",
    background: "#0A0E0C",
    text: "#E4EAE4",
    muted: "#7C877E",
    border: "#1D2420",
    accent: "#5FD97A",
    headlineFont: THEME_FONTS.terminal.headline,
    bodyFont: THEME_FONTS.terminal.body,
  },
  polaroid: {
    mode: "light",
    background: "#FDF6EC",
    text: "#2B241C",
    muted: "#8A8578",
    border: "#EADFC9",
    accent: "#D6455D",
    headlineFont: THEME_FONTS.polaroid.headline,
    bodyFont: THEME_FONTS.polaroid.body,
  },
  brutalist: {
    mode: "light",
    background: "#FFFFFF",
    text: "#000000",
    muted: "#3A3A3A",
    border: "#000000",
    accent: "#000000",
    headlineFont: THEME_FONTS.brutalist.headline,
    bodyFont: THEME_FONTS.brutalist.body,
  },
  pastelStack: {
    mode: "light",
    background: "#FFFFFF",
    text: "#2A2A2A",
    muted: "#6B6558",
    border: "#EFECE4",
    accent: "#C23E62",
    headlineFont: THEME_FONTS.pastelStack.headline,
    bodyFont: THEME_FONTS.pastelStack.body,
  },
  indexCard: {
    mode: "light",
    background: "#FFFFFF",
    text: "#16130F",
    muted: "#6B6558",
    border: "#E5E1D6",
    accent: "#8A6A2F",
    headlineFont: THEME_FONTS.indexCard.headline,
    bodyFont: THEME_FONTS.indexCard.body,
  },
};
