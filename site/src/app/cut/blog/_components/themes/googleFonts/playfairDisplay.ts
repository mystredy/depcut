// See archivo.ts for why this is its own module.
import { Playfair_Display } from "next/font/google";

const playfairDisplay = Playfair_Display({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });

export const fontFamily = playfairDisplay.style.fontFamily;
