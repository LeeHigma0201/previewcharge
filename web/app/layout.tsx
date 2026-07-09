import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HorseGPT — Today's Card",
  description:
    "Today's race card with Brisnet Prime Power scoring + Monte Carlo exotic pricing.",
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
