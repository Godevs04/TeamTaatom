import Link from "next/link";
import { createMetadata } from "@/lib/seo";
import {
  ArticleSection,
  PublicArticleShell,
} from "@/components/content/public-article-shell";

export const metadata = createMetadata({
  title: "About Taatom",
  description:
    "Learn who builds Taatom, why travel storytelling needs better place context, and how our product helps travelers journal trips with privacy controls.",
  path: "/about",
});

export default function AboutPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "About Taatom",
    url: "https://taatom.com/about",
    mainEntity: {
      "@type": "Organization",
      name: "Taatom",
      url: "https://taatom.com",
      email: "contact@taatom.com",
      sameAs: ["https://taatom.com/download"],
      description:
        "Taatom is a travel storytelling platform for journaling trips with photos, video, place context, communities, and privacy controls.",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicArticleShell
        eyebrow="About"
        title="Taatom exists so travel stories keep their place, people, and context"
        description="We build tools for travelers who want more than a camera roll: journals with locations, journeys you can revisit, communities around destinations, and privacy settings that travel as carefully as you do."
        metaLine="Taatom · Travel storytelling platform · contact@taatom.com"
      >
        <ArticleSection heading="What Taatom is">
          <p>
            Taatom is a travel-first social product available on web, iOS, and Android. People use it
            to publish trip photos and videos, attach places, follow creators, join Connect
            communities, track journeys, and — when they choose — share live Navigate sessions with
            trusted companions.
          </p>
          <p>
            Unlike generic social feeds that treat travel as disposable content, Taatom is organized
            around places and trips. Public locale pages, trip links, and profiles let visitors
            explore destinations even before they create an account, while deeper tools remain
            available after sign-in.
          </p>
        </ArticleSection>

        <ArticleSection heading="What problem we are solving">
          <p>
            Travel memories fragment across camera rolls, chat threads, and maps. Captions get lost,
            pins are wrong, and friends cannot follow the route without a dozen screenshots. Creators
            who publish destination advice often lack a stable home for communities and optional
            paid notes.
          </p>
          <p>
            Taatom brings media, location, journeys, Connect pages, and monetization tools into one
            product so stories stay structured. We invest in privacy controls because travel content
            can reveal routines and addresses — sharing should be intentional.
          </p>
        </ArticleSection>

        <ArticleSection heading="Product pillars">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Journals &amp; journeys</strong> — photo posts, Shorts, and long videos grouped
              into readable trip narratives.
            </li>
            <li>
              <strong>Places</strong> — locale pages and location tags that help people discover
              destinations through real traveler media.
            </li>
            <li>
              <strong>TripScore</strong> — a personal map of where you have documented travel, not a
              vanity contest.
            </li>
            <li>
              <strong>Connect</strong> — community pages with optional group chat and subscriptions.
            </li>
            <li>
              <strong>Navigate</strong> — live session tools for companions who need your route now.
            </li>
            <li>
              <strong>Creator tools</strong> — dashboards for eligible video monetization, separate
              from Connect subscriptions.
            </li>
          </ul>
        </ArticleSection>

        <ArticleSection heading="How we approach trust">
          <p>
            We publish clear{" "}
            <Link href="/privacy" className="font-medium text-sky-700 underline dark:text-sky-300">
              Privacy
            </Link>
            ,{" "}
            <Link href="/terms" className="font-medium text-sky-700 underline dark:text-sky-300">
              Terms
            </Link>
            ,{" "}
            <Link
              href="/community-guidelines"
              className="font-medium text-sky-700 underline dark:text-sky-300"
            >
              Community Guidelines
            </Link>
            , and{" "}
            <Link
              href="/child-safety"
              className="font-medium text-sky-700 underline dark:text-sky-300"
            >
              Child Safety
            </Link>{" "}
            policies. Ads, when shown, appear only beside substantial publisher content and follow
            Google Publisher Policies. We do not sell personal information.
          </p>
          <p>
            Questions about the company or product are welcome at{" "}
            <a
              href="mailto:contact@taatom.com"
              className="font-medium text-sky-700 underline dark:text-sky-300"
            >
              contact@taatom.com
            </a>{" "}
            or via our{" "}
            <Link href="/contact" className="font-medium text-sky-700 underline dark:text-sky-300">
              contact form
            </Link>
            .
          </p>
        </ArticleSection>

        <ArticleSection heading="Keep learning">
          <p>
            Explore our{" "}
            <Link href="/guides" className="font-medium text-sky-700 underline dark:text-sky-300">
              travel guides
            </Link>{" "}
            for journaling workflows, privacy practices, Connect communities, and creator rules. For
            app installs, visit{" "}
            <Link href="/download" className="font-medium text-sky-700 underline dark:text-sky-300">
              Download
            </Link>
            . For account help, open the{" "}
            <Link href="/help" className="font-medium text-sky-700 underline dark:text-sky-300">
              Help center
            </Link>
            .
          </p>
        </ArticleSection>
      </PublicArticleShell>
    </>
  );
}
