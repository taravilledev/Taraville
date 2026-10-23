import type { Metadata } from "next";
import { appFonts } from "./walkin/app-fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taraville Group",
  description: "ระบบรับเรื่องผู้สนใจ Taraville Group",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${appFonts} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
