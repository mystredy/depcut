// See archivo.ts for why this is its own module.
import { JetBrains_Mono } from "next/font/google";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false });

export const fontFamily = jetbrainsMono.style.fontFamily;
