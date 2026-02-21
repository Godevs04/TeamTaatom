import type { Metadata } from "next";
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

export const metadata: Metadata = {
  ...createMetadata({}),
  title: {
    default: "Taatom — Travel stories that feel alive",
    template: "%s · Taatom",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProviders>
          <SiteHeader />
          <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 py-8">{children}</main>
        </AppProviders>
        <Analytics />
      </body>
    </html>
  );
}
