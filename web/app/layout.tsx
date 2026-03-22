import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HorseGPT v3.14",
  description:
    "Multi-model horse racing handicapping tool. Benter odds-offset logistic + LightGBM ensemble with Monte Carlo exotic pricing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans">
        {children}
      </body>
    </html>
  );
}
