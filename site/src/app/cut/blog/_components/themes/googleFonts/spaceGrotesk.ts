// See archivo.ts for why this is its own module.
import { Space_Grotesk } from "next/font/google";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });

export const fontFamily = spaceGrotesk.style.fontFamily;
