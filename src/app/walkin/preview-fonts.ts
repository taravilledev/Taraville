import { Anuphan, Nunito, Nunito_Sans, Sarabun } from "next/font/google";

const anuphan = Anuphan({ subsets: ["thai", "latin"], variable: "--font-anuphan", adjustFontFallback: false, preload: false });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", adjustFontFallback: false, preload: false });
const sarabun = Sarabun({ weight: ["400", "600", "700"], subsets: ["thai", "latin"], variable: "--font-sarabun", adjustFontFallback: false, preload: false });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", adjustFontFallback: false, preload: false });

export const previewFonts = `${anuphan.variable} ${nunitoSans.variable} ${sarabun.variable} ${nunito.variable}`;
