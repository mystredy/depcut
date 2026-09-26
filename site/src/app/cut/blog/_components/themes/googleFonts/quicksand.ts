// See archivo.ts for why this is its own module.
import { Quicksand } from "next/font/google";

const quicksand = Quicksand({ subsets: ["latin"], weight: ["500", "600", "700"], preload: false });

export const fontFamily = quicksand.style.fontFamily;
