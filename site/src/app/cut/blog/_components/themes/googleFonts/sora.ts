// See archivo.ts for why this is its own module.
import { Sora } from "next/font/google";

const sora = Sora({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });

export const fontFamily = sora.style.fontFamily;
