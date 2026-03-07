import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppProviders from "../providers/app-providers";
import { SiteHeader } from "../components/layout/site-header";
import { Analytics } from "../components/analytics";
import { createMetadata } from "../lib/seo";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
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
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <div suppressHydrationWarning className="min-h-screen">
          <AppProviders>
            <SiteHeader />
            <main className="min-h-[calc(100vh-3.5rem)] w-full">{children}</main>
          </AppProviders>
          <Analytics />
        </div>
      </body>
    </html>
  );
}
