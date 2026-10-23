import { Nunito, Sarabun } from "next/font/google";

const sarabun = Sarabun({ weight: ["400", "600", "700"], subsets: ["thai", "latin"], variable: "--font-sarabun", adjustFontFallback: false, preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", adjustFontFallback: false, preload: false });

export const appFonts = `${sarabun.variable} ${nunito.variable}`;
