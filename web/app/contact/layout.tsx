import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Contact Taatom",
  description:
    "Contact Taatom for product support, partnerships, privacy requests, and safety reports. Typical replies within 1–3 business days.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
