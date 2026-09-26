// See archivo.ts for why this is its own module.
import { Libre_Franklin } from "next/font/google";

const libreFranklin = Libre_Franklin({ subsets: ["latin"], weight: ["600", "700", "800"], preload: false });

export const fontFamily = libreFranklin.style.fontFamily;
