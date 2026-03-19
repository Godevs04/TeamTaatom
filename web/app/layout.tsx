import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "../providers/app-providers";
import { SiteHeader } from "../components/layout/site-header";
import { Analytics } from "../components/analytics";
import { createMetadata } from "../lib/seo";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export const metadata: Metadata = {
  ...createMetadata({}),
  title: {
    default: "Taatom — Travel stories that feel alive",
    template: "%s · Taatom",
  },
  icons: {
    icon: "/icon.png?v=2",
    apple: "/icon.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} font-sans antialiased`} suppressHydrationWarning>
        <div suppressHydrationWarning className="min-h-screen">
          <AppProviders>
            <SiteHeader />
            <main className="min-h-[calc(100vh-3.5rem)] w-full">{children}</main>
            <footer className="border-t border-slate-200/70 bg-white/90 py-4 text-xs text-slate-500 sm:py-5">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-3 text-center sm:justify-between sm:px-4 md:px-6">
                <div className="space-x-2">
                  <Link href="/" className="hover:text-slate-900 hover:underline">
                    Home
                  </Link>
                  <span>•</span>
                  <Link href="/privacy" className="hover:text-slate-900 hover:underline">
                    Privacy Policy
                  </Link>
                  <span>•</span>
                  <Link href="/terms" className="hover:text-slate-900 hover:underline">
                    Terms of Service
                  </Link>
                  <span>•</span>
                  <Link href="/copyrights" className="hover:text-slate-900 hover:underline">
                    Copyright Consent
                  </Link>
                  <span>•</span>
                  <Link href="/child-safety" className="hover:text-slate-900 hover:underline">
                    Child Safety
                  </Link>
                  <span>•</span>
                  <Link href="/contact" className="hover:text-slate-900 hover:underline">
                    Contact Us
                  </Link>
                </div>
                <div className="mt-1 sm:mt-0">
                  <span>© {new Date().getFullYear()} Taatom. All rights reserved.</span>
                </div>
              </div>
            </footer>
          </AppProviders>
          <Analytics />
        </div>
      </body>
    </html>
  );
}
