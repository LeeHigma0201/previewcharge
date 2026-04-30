import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HorseGPT — Churchill Downs Thu Apr 30",
  description:
    "Churchill Downs Thursday April 30 2026 — Brisnet Ultimate PPs handicapping with Monte Carlo exotic pricing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-black font-sans">
        {children}
      </body>
    </html>
  );
}
