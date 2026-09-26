// See archivo.ts for why this is its own module.
import { Source_Serif_4 } from "next/font/google";

const sourceSerif4 = Source_Serif_4({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });

export const fontFamily = sourceSerif4.style.fontFamily;
