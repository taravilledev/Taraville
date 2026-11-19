import { Noto_Sans_Thai, Nunito, Sarabun } from "next/font/google";

const sarabun = Sarabun({ weight: ["400", "600", "700"], subsets: ["thai", "latin"], variable: "--font-sarabun", adjustFontFallback: false, preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", adjustFontFallback: false, preload: false });
const notoThai = Noto_Sans_Thai({ subsets: ["thai", "latin"], weight: ["400", "500", "600", "700"], variable: "--font-noto-thai", preload: false, display: "swap" });

export const appFonts = `${sarabun.variable} ${nunito.variable} ${notoThai.variable}`;
