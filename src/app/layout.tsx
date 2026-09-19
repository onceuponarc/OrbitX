import { AppShell } from "@/components/app-shell";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { PUBLIC_SITE_URL } from "@onceupon/config/urls";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(PUBLIC_SITE_URL),
  title: {
    default: "OrbitX — multi-chain launchpad",
    template: "%s · OrbitX",
  },
  description: "OrbitX multi-chain launchpad. Solana, Arc, and Robinhood Chain are all live. Launch, trade, graduate.",
  applicationName: "OrbitX",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "OrbitX",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/brand/logo.jpg", type: "image/jpeg" },
    ],
    apple: [{ url: "/brand/logo.jpg", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-parchment">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
