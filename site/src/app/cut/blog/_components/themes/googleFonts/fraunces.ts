// See archivo.ts for why this is its own module.
import { Fraunces } from "next/font/google";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });

export const fontFamily = fraunces.style.fontFamily;
