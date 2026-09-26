// See archivo.ts for why this is its own module.
import { Caveat } from "next/font/google";

const caveat = Caveat({ subsets: ["latin"], weight: ["600", "700"], preload: false });

export const fontFamily = caveat.style.fontFamily;
