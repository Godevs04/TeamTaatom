import { notFound } from "next/navigation";
import { createMetadata } from "@/lib/seo";
import { getAllGuideSlugs, getGuide } from "@/lib/guides";
import {
  ArticleSection,
  PublicArticleShell,
} from "@/components/content/public-article-shell";

type PageProps = { params: { slug: string } };

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps) {
  const guide = getGuide(params.slug);
  if (!guide) return {};
  return createMetadata({
    title: guide.title,
    description: guide.description,
    path: `/guides/${guide.slug}`,
    openGraphType: "article",
  });
}

export default function GuideArticlePage({ params }: PageProps) {
  const guide = getGuide(params.slug);
  if (!guide) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    author: { "@type": "Organization", name: "Taatom" },
    publisher: {
      "@type": "Organization",
      name: "Taatom",
      url: "https://taatom.com",
    },
    mainEntityOfPage: `https://taatom.com/guides/${guide.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicArticleShell
        eyebrow="Guide"
        title={guide.title}
        description={guide.description}
        metaLine={`Published ${guide.publishedAt} · Updated ${guide.updatedAt} · ${guide.readingMinutes} min read · By Taatom`}
        backHref="/guides"
        backLabel="All guides"
      >
        {guide.sections.map((section) => (
          <ArticleSection key={section.heading} heading={section.heading}>
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 48)}>{p}</p>
            ))}
            {section.bullets?.length ? (
              <ul className="list-disc space-y-1.5 pl-5">
                {section.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </ArticleSection>
        ))}
      </PublicArticleShell>
    </>
  );
}
