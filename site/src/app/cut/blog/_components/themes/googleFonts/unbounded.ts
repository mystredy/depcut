// See archivo.ts for why this is its own module.
import { Unbounded } from "next/font/google";

const unbounded = Unbounded({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });

export const fontFamily = unbounded.style.fontFamily;
