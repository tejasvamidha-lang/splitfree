import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";

import { BottomNav } from "@/components/BottomNav";
import { PWARegister } from "@/components/PWARegister";

import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SplitFree",
  description: "SplitFree helps friends split daily expenses, track balances, and settle up.",
  manifest: "/manifest.json",
  applicationName: "SplitFree",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SplitFree",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.svg", type: "image/svg+xml" },
      { url: "/icons/icon-512.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192.svg", type: "image/svg+xml" }],
  },
};

export const viewport = {
  themeColor: "#f7f4ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-radial-pattern text-slate-900">
        <PWARegister />
        <div className="min-h-screen pb-20 md:pb-0">{children}</div>
        <BottomNav />
      </body>
    </html>
  );
}
