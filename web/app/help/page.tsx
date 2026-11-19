import Link from "next/link";
import { createMetadata } from "@/lib/seo";
import {
  ArticleSection,
  PublicArticleShell,
} from "@/components/content/public-article-shell";

export const metadata = createMetadata({
  title: "Help Center",
  description:
    "Public Taatom help: sharing trips, Connect, Navigate, music on Shorts, creator monetization, privacy, and how to contact support.",
  path: "/help",
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I share a trip?",
    a: "Open Create, add photos or a short video, set a place if you like, write a caption with at least one concrete detail, choose visibility, then publish. Your post appears on your profile and can appear in feeds depending on privacy. Group related posts into a Journey so friends can read the route in order.",
  },
  {
    q: "What is Connect?",
    a: "Connect lets you follow creator or community pages and optionally join group chat or subscriptions. Pages can be public, followers-only, or private. Open Connect to browse communities, or create a page when you have ongoing destination value to publish.",
  },
  {
    q: "How does Navigate work on web?",
    a: "Navigate uses your browser location while the tab stays open. It is meant for trusted companions during an active outing. For reliable background GPS tracking, use the Taatom mobile app, and always end sessions when you are done.",
  },
  {
    q: "Can I add music to Shorts?",
    a: "Yes. When uploading a Short, choose Taatom music to pick a licensed track and optional trim points. Keep volume balanced if you speak, and do not upload copyrighted tracks you do not have rights to use.",
  },
  {
    q: "How does Creator Monetization work?",
    a: "Open your profile and choose Creator Dashboard. Eligibility typically requires followers, multiple eligible videos in a calendar month, and enough eligible views — confirm current thresholds in-product. Earnings use eligible views, may stay pending until monthly validation, and require identity verification for withdrawals. Photos do not earn. Buying views or bots can end the program. This is separate from Connect subscriptions.",
  },
  {
    q: "How do I control who sees my posts?",
    a: "Each post can be public, followers-only, or private. Your profile also has visibility settings. Delay public posts while you are still at a sensitive location, and avoid tagging private residences.",
  },
  {
    q: "Where can I learn journaling best practices?",
    a: "Visit the Guides section for original articles on documenting trips, TripScore, privacy, Connect, Shorts, Navigate, and creator rules. Start at /guides.",
  },
  {
    q: "How do I delete my account or request data help?",
    a: "Signed-in users can manage account settings in the app or web settings. For privacy requests or unresolved issues, email contact@taatom.com or use the Contact form and include the email on your account.",
  },
];

export default function HelpCenterPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicArticleShell
        eyebrow="Help"
        title="Taatom Help Center"
        description="Clear answers for travelers and creators using Taatom on web and mobile. If you still need a human, contact support — we read every message."
        metaLine="Public help · No login required"
      >
        <ArticleSection heading="Quick links">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <Link href="/guides" className="font-medium text-sky-700 underline dark:text-sky-300">
                Travel guides
              </Link>{" "}
              — deep how-tos and product explainers.
            </li>
            <li>
              <Link href="/contact" className="font-medium text-sky-700 underline dark:text-sky-300">
                Contact support
              </Link>{" "}
              — bugs, account access, safety reports.
            </li>
            <li>
              <Link
                href="/community-guidelines"
                className="font-medium text-sky-700 underline dark:text-sky-300"
              >
                Community Guidelines
              </Link>{" "}
              — what is allowed on Taatom.
            </li>
            <li>
              <Link href="/download" className="font-medium text-sky-700 underline dark:text-sky-300">
                Download the app
              </Link>{" "}
              — iOS and Android installs.
            </li>
          </ul>
        </ArticleSection>

        {FAQS.map((item) => (
          <ArticleSection key={item.q} heading={item.q}>
            <p>{item.a}</p>
          </ArticleSection>
        ))}
      </PublicArticleShell>
    </>
  );
}
