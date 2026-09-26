// See archivo.ts for why this is its own module.
import { IBM_Plex_Sans } from "next/font/google";

const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], preload: false });

export const fontFamily = ibmPlexSans.style.fontFamily;
