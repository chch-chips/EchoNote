import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-ink text-paper">{children}</body>
    </html>
  );
}
