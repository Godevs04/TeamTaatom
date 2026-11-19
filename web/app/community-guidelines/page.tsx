import Link from "next/link";
import { createMetadata } from "@/lib/seo";
import {
  ArticleSection,
  PublicArticleShell,
} from "@/components/content/public-article-shell";

export const metadata = createMetadata({
  title: "Community Guidelines",
  description:
    "Taatom community rules for respectful travel storytelling: safety, hate, spam, copyright, minors, and enforcement.",
  path: "/community-guidelines",
});

export default function CommunityGuidelinesPage() {
  return (
    <PublicArticleShell
      eyebrow="Safety"
      title="Taatom Community Guidelines"
      description="These rules keep Taatom useful for travelers and creators. They apply to posts, Shorts, comments, chats, Connect pages, and profiles on web and mobile."
      metaLine="Last updated March 20, 2026"
    >
      <ArticleSection heading="Be respectful">
        <p>
          Do not harass, threaten, or demean people. Hate based on race, religion, gender, identity,
          orientation, disability, nationality, or similar characteristics is not allowed. Debate
          destinations and itineraries; do not attack people.
        </p>
      </ArticleSection>

      <ArticleSection heading="Keep travel spaces safe">
        <p>
          Do not post content that promotes violence, self-harm, exploitation, or dangerous
          challenges. Do not share someone else’s live location without consent. Do not publish
          private addresses, documents, or intimate images.
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>No scams, phishing, or impersonation of Taatom or other brands.</li>
          <li>No spam, fake engagement, or bought views.</li>
          <li>No graphic sexual content or content that sexualizes minors.</li>
        </ul>
      </ArticleSection>

      <ArticleSection heading="Respect copyright and originality">
        <p>
          Post media you created or have rights to share. Do not upload movies, TV rips, or other
          people’s photos as your travel content. Music must come from allowed Taatom libraries or
          sources you are licensed to use. See also our{" "}
          <Link href="/copyrights" className="font-medium text-sky-700 underline dark:text-sky-300">
            Copyright Consent
          </Link>{" "}
          page.
        </p>
      </ArticleSection>

      <ArticleSection heading="Protect minors">
        <p>
          Taatom is not for children under 12. Do not exploit or endanger minors. Report suspected
          child sexual exploitation immediately through{" "}
          <Link href="/child-safety" className="font-medium text-sky-700 underline dark:text-sky-300">
            Child Safety
          </Link>{" "}
          channels and local authorities when required.
        </p>
      </ArticleSection>

      <ArticleSection heading="Connect pages and monetization">
        <p>
          Page admins are responsible for moderation in their communities. Paid content must match
          what was promised. Creator Monetization requires original eligible video and compliance
          with program rules — manipulation can end access.
        </p>
      </ArticleSection>

      <ArticleSection heading="Enforcement">
        <p>
          We may remove content, limit features, or suspend accounts that break these guidelines or
          our{" "}
          <Link href="/terms" className="font-medium text-sky-700 underline dark:text-sky-300">
            Terms
          </Link>
          . To report a problem, use in-app reporting or{" "}
          <Link href="/contact" className="font-medium text-sky-700 underline dark:text-sky-300">
            Contact
          </Link>
          .
        </p>
      </ArticleSection>
    </PublicArticleShell>
  );
}
