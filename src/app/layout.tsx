import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Min Journal",
  description: "A single-user CRT trading journal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
