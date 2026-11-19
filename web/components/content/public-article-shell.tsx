import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type PublicArticleShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  metaLine?: string;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function PublicArticleShell({
  eyebrow,
  title,
  description,
  metaLine,
  children,
  backHref = "/",
  backLabel = "Back to Home",
}: PublicArticleShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <header className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8">
          <div className="max-w-3xl text-slate-50">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            {description ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-100/90 sm:text-base">
                {description}
              </p>
            ) : null}
            {metaLine ? (
              <p className="mt-4 text-xs font-medium text-sky-50/90">{metaLine}</p>
            ) : null}
          </div>
        </header>

        <article className="space-y-6">{children}</article>

        <nav
          aria-label="Related pages"
          className="flex flex-wrap gap-3 rounded-3xl border border-slate-200/80 bg-white/95 p-5 text-sm dark:border-zinc-800/80 dark:bg-zinc-900/95"
        >
          <Link href="/guides" className="font-medium text-sky-700 hover:underline dark:text-sky-300">
            Travel guides
          </Link>
          <span className="text-slate-300 dark:text-zinc-600">·</span>
          <Link href="/about" className="font-medium text-sky-700 hover:underline dark:text-sky-300">
            About Taatom
          </Link>
          <span className="text-slate-300 dark:text-zinc-600">·</span>
          <Link href="/help" className="font-medium text-sky-700 hover:underline dark:text-sky-300">
            Help center
          </Link>
          <span className="text-slate-300 dark:text-zinc-600">·</span>
          <Link href="/contact" className="font-medium text-sky-700 hover:underline dark:text-sky-300">
            Contact
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function ArticleSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-8">
      <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700 dark:text-zinc-300 sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}
