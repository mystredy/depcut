// See archivo.ts for why this is its own module.
import { Baloo_2 } from "next/font/google";

const baloo2 = Baloo_2({ subsets: ["latin"], weight: ["600", "700"], preload: false });

export const fontFamily = baloo2.style.fontFamily;
