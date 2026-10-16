import type { Metadata, Viewport } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans-loaded",
  subsets: ["latin"],
});

// Display face for the wordmark and panel titles — a warm serif against the
// clean UI sans gives the app a voice rather than a template look.
const display = Instrument_Serif({
  variable: "--font-display-loaded",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Pulse — a living globe of strangers",
  description:
    "Every light on the map is a real person online right now. Tap one to say hello. Nothing is stored.",
};

export const viewport: Viewport = {
  themeColor: "#080b14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
