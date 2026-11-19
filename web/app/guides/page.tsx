import Link from "next/link";
import { createMetadata } from "@/lib/seo";
import { GUIDES } from "@/lib/guides";
import { PublicArticleShell } from "@/components/content/public-article-shell";

export const metadata = createMetadata({
  title: "Travel guides & product tips",
  description:
    "Original Taatom guides on trip journaling, TripScore, privacy, Connect communities, creator monetization, Navigate safety, and Shorts.",
  path: "/guides",
});

export default function GuidesIndexPage() {
  return (
    <PublicArticleShell
      eyebrow="Guides"
      title="Travel storytelling guides from the Taatom team"
      description="Practical, original articles about documenting trips, protecting privacy, building communities, and using Taatom features with care. Written for travelers and creators — not keyword filler."
      metaLine={`${GUIDES.length} guides · Updated regularly`}
    >
      <ul className="space-y-4">
        {GUIDES.map((guide) => (
          <li key={guide.slug}>
            <Link
              href={`/guides/${guide.slug}`}
              className="block rounded-3xl border border-slate-200/80 bg-white/95 p-5 shadow-soft transition hover:border-sky-300 dark:border-zinc-800/80 dark:bg-zinc-900/95 dark:hover:border-sky-700"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-zinc-400">
                <time dateTime={guide.updatedAt}>Updated {guide.updatedAt}</time>
                <span aria-hidden>·</span>
                <span>{guide.readingMinutes} min read</span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-zinc-50">
                {guide.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                {guide.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {guide.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PublicArticleShell>
  );
}
