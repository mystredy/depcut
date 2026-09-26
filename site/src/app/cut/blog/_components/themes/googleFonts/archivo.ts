// Split out of the old single fonts.ts on purpose: Turbopack's font
// resolver ("next/font/google queries have exactly one entry") was
// nondeterministically failing on a different font each Vercel build when
// this many next/font/google() calls shared one module — see fonts.ts.
import { Archivo } from "next/font/google";

const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800", "900"], preload: false });

export const fontFamily = archivo.style.fontFamily;
