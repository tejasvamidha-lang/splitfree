import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import Link from "next/link";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-radial-pattern text-slate-900 flex flex-col">
        <PWARegister />
        
        {/* Desktop & Tablet Top Navigation Bar */}
        <header className="sticky top-0 z-40 hidden md:block border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-base font-bold text-white shadow-sm">
                ₹
              </span>
              <span className="font-serif text-xl font-bold tracking-tight text-slate-900">
                SplitFree
              </span>
            </Link>

            <nav className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/groups"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Groups
              </Link>
              <Link
                href="/friends"
                className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                Friends
              </Link>
              <Link
                href="/expenses/new"
                className="ml-2 rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-800 transition-colors"
              >
                + Add Expense
              </Link>
            </nav>
          </div>
        </header>

        {/* Page Content */}
        <div className="min-h-screen pb-24 md:pb-12">{children}</div>

        {/* Mobile Bottom Navigation */}
        <BottomNav />
      </body>
    </html>
  );
}