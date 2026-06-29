import type { Metadata } from "next";
import { Inter, Noto_Serif_SC } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const notoSerifSc = Noto_Serif_SC({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "EchoNote",
  description: "A private capture desk for quick notes and poetic memory echoes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={inter.variable + " " + notoSerifSc.variable + " h-full antialiased"}>
      <body className="min-h-full bg-ink text-paper">{children}</body>
    </html>
  );
}
