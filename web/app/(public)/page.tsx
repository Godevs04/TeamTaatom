import { LandingPage } from "@/components/landing/landing-page";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: null,
  description:
    "Taatom helps travelers journal trips with photos, Shorts, places, Connect communities, and privacy controls. Read our guides, explore destinations, and download the app.",
  path: "/",
});

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://taatom.com/#organization",
        name: "Taatom",
        url: "https://taatom.com",
        email: "contact@taatom.com",
        logo: "https://taatom.com/icon.png",
        sameAs: ["https://taatom.com/download"],
        description:
          "Travel storytelling platform for journaling trips with place context, communities, and privacy controls.",
      },
      {
        "@type": "WebSite",
        "@id": "https://taatom.com/#website",
        url: "https://taatom.com",
        name: "Taatom",
        publisher: { "@id": "https://taatom.com/#organization" },
        potentialAction: {
          "@type": "SearchAction",
          target: "https://taatom.com/locale",
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
