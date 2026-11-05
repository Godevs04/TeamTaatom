import type { Metadata } from "next";
import { createMetadata } from "../../../lib/seo";

export const metadata: Metadata = createMetadata({
  title: "Travel destinations & places to visit",
  description:
    "Discover curated travel destinations on Taatom — historical, cultural, natural, adventure and spiritual spots with photos, travel info and directions.",
  path: "/locale",
});

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return children;
}
