// See archivo.ts for why this is its own module.
import { IBM_Plex_Mono } from "next/font/google";

const ibmPlexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });

export const fontFamily = ibmPlexMono.style.fontFamily;
