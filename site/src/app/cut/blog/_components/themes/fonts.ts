// Every custom typeface a blog theme uses, self-hosted at build time via
// next/font/google — same pattern as cut/lib/googleFonts.ts (the editor's
// own font registry), kept separate since this one serves the public blog,
// not the Cut editor. A theme names its faces through THEME_FONTS below,
// never a raw <link> or an unloaded font-family string, so what themes.ts
// promised (Fraunces, Playfair Display, JetBrains Mono, …) actually renders.
//
// Each font is its own module under googleFonts/ rather than one
// next/font/google() call per line here — Turbopack's font resolver
// ("next/font/google queries have exactly one entry") was
// nondeterministically failing on a different font each Vercel build when
// this many calls shared one module.
import { fontFamily as archivo } from "./googleFonts/archivo";
import { fontFamily as baloo2 } from "./googleFonts/baloo2";
import { fontFamily as caveatFamily } from "./googleFonts/caveat";
import { fontFamily as fraunces } from "./googleFonts/fraunces";
import { fontFamily as ibmPlexMono } from "./googleFonts/ibmPlexMono";
import { fontFamily as ibmPlexSans } from "./googleFonts/ibmPlexSans";
import { fontFamily as jetbrainsMono } from "./googleFonts/jetbrainsMono";
import { fontFamily as libreFranklin } from "./googleFonts/libreFranklin";
import { fontFamily as playfairDisplay } from "./googleFonts/playfairDisplay";
import { fontFamily as quicksand } from "./googleFonts/quicksand";
import { fontFamily as sora } from "./googleFonts/sora";
import { fontFamily as sourceSerif4 } from "./googleFonts/sourceSerif4";
import { fontFamily as spaceGrotesk } from "./googleFonts/spaceGrotesk";
import { fontFamily as unbounded } from "./googleFonts/unbounded";

import type { BlogThemeId } from "@/lib/blog/themes";

const SANS = `${ibmPlexSans}, system-ui, sans-serif`;
const MONO = `${ibmPlexMono}, ui-monospace, monospace`;

/** A theme's two faces, as ready-to-use font-family values (loaded family
 * plus a plain fallback) — never the loaded font object itself, so callers
 * just drop these into an inline style. */
export const THEME_FONTS: Record<BlogThemeId, { headline: string; body: string }> = {
  glass: { headline: "inherit", body: "inherit" },
  ledger: { headline: `${sourceSerif4}, Georgia, serif`, body: SANS },
  bulletin: { headline: `${archivo}, system-ui, sans-serif`, body: SANS },
  quietPaper: { headline: `${fraunces}, Georgia, serif`, body: SANS },
  nightdesk: { headline: `${spaceGrotesk}, system-ui, sans-serif`, body: SANS },
  deck: { headline: `${sora}, system-ui, sans-serif`, body: SANS },
  digest: { headline: `${libreFranklin}, system-ui, sans-serif`, body: SANS },
  broadsheet: { headline: `${playfairDisplay}, Georgia, serif`, body: SANS },
  terminal: { headline: `${jetbrainsMono}, ui-monospace, monospace`, body: MONO },
  polaroid: { headline: `${baloo2}, system-ui, sans-serif`, body: SANS },
  brutalist: { headline: `${unbounded}, system-ui, sans-serif`, body: MONO },
  pastelStack: { headline: `${quicksand}, system-ui, sans-serif`, body: SANS },
  indexCard: { headline: SANS, body: SANS },
};

/** Polaroid's handwritten-style tag accent — the one face no other theme
 * shares, so it isn't worth a THEME_FONTS slot of its own. */
export const CAVEAT_FONT = `${caveatFamily}, cursive`;
