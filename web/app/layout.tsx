import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HorseGPT — Keeneland April 18, 2026",
  description:
    "Data-first horse racing handicapping. Monte Carlo + EV overlay + A/B/C exotic tiering. Tuned for Keeneland spring meet.",
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
