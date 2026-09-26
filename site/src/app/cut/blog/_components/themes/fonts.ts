// Every custom typeface a blog theme uses, self-hosted at build time via
// next/font/google — same pattern as cut/lib/googleFonts.ts (the editor's
// own font registry), kept separate since this one serves the public blog,
// not the Cut editor. A theme names its faces through THEME_FONTS below,
// never a raw <link> or an unloaded font-family string, so what themes.ts
// promised (Fraunces, Playfair Display, JetBrains Mono, …) actually renders.
import {
  Archivo,
  Baloo_2,
  Caveat,
  Fraunces,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Libre_Franklin,
  Playfair_Display,
  Quicksand,
  Sora,
  Source_Serif_4,
  Space_Grotesk,
  Unbounded,
} from "next/font/google";

import type { BlogThemeId } from "@/lib/blog/themes";

const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800", "900"], preload: false });
const baloo2 = Baloo_2({ subsets: ["latin"], weight: ["600", "700"], preload: false });
const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"], preload: false });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false });
const libreFranklin = Libre_Franklin({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });
const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });
const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });
const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });
const sourceSerif4 = Source_Serif_4({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });
const unbounded = Unbounded({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });

const SANS = `${ibmPlexSans.style.fontFamily}, system-ui, sans-serif`;
const MONO = `${ibmPlexMono.style.fontFamily}, ui-monospace, monospace`;

/** A theme's two faces, as ready-to-use font-family values (loaded family
 * plus a plain fallback) — never the loaded font object itself, so callers
 * just drop these into an inline style. */
export const THEME_FONTS: Record<BlogThemeId, { headline: string; body: string }> = {
  glass: { headline: "inherit", body: "inherit" },
  ledger: { headline: `${sourceSerif4.style.fontFamily}, Georgia, serif`, body: SANS },
  bulletin: { headline: `${archivo.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  quietPaper: { headline: `${fraunces.style.fontFamily}, Georgia, serif`, body: SANS },
  nightdesk: { headline: `${spaceGrotesk.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  deck: { headline: `${sora.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  digest: { headline: `${libreFranklin.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  broadsheet: { headline: `${playfairDisplay.style.fontFamily}, Georgia, serif`, body: SANS },
  terminal: { headline: `${jetbrainsMono.style.fontFamily}, ui-monospace, monospace`, body: MONO },
  polaroid: { headline: `${baloo2.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  brutalist: { headline: `${unbounded.style.fontFamily}, system-ui, sans-serif`, body: MONO },
  pastelStack: { headline: `${quicksand.style.fontFamily}, system-ui, sans-serif`, body: SANS },
  indexCard: { headline: SANS, body: SANS },
};

/** Polaroid's handwritten-style tag accent — the one face no other theme
 * shares, so it isn't worth a THEME_FONTS slot of its own. */
export const CAVEAT_FONT = `${caveat.style.fontFamily}, cursive`;
