import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ChildSafetyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8 md:px-10">
        <div className="max-w-3xl text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
            Child Safety
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Keeping young travelers safe on Taatom.
          </h1>
          <p className="mt-4 text-sm text-slate-100/90">
            This page explains how we protect children on the platform, moderate content, and how
            parents or guardians can report issues or request support.
          </p>
        </div>
      </div>

      {/* Content Moderation Response */}
      <section className="overflow-hidden rounded-3xl border border-emerald-200/90 bg-emerald-50/90 p-5 shadow-soft dark:border-emerald-900/40 dark:bg-emerald-950/35 sm:p-6 md:p-7">
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 sm:text-xl">
          Content Moderation Response
        </h2>
        <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100/90">
          We remove harmful content within <strong>24 hours</strong> after report review (in most
          cases faster). For urgent issues or escalations, contact{" "}
          <a href="mailto:contact@taatom.com" className="font-semibold underline">
            contact@taatom.com
          </a>
          .
        </p>
      </section>

      {/* Executive Summary */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">Executive Summary</h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
          Taatom is a travel‑focused social media app that enables users to share photos, videos,
          and location‑based content. This page explains how we protect children on the platform,
          how content is moderated, and how parents or guardians can report issues.
        </p>

        <div className="mt-4 grid gap-3 text-sm text-slate-800 dark:text-zinc-200 md:grid-cols-2">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Minimum age requirement: <strong>12+</strong> (COPPA compliant).
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Comprehensive content moderation system.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Multi‑category user reporting system.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Extensive privacy controls.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             User blocking functionality.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Copyright protection measures.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
            Content guidelines clearly defined.
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2.5 dark:border-emerald-900/40 dark:bg-emerald-950/40">
             Privacy Policy and Terms of Service published.
          </div>
        </div>
      </section>

      {/* Age Restrictions & COPPA */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">
          Age Restrictions &amp; COPPA Compliance
        </h2>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800/60 dark:bg-zinc-800/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Age Requirement</h3>
          <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
            <strong>Minimum age:</strong> 12+ years.
          </p>
          <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
            <strong>Statement:</strong> “You must be at least 12 years old to use the App.”
          </p>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-zinc-800/60 dark:bg-zinc-800/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">Account Creation</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>Users confirm they meet the minimum age during registration.</li>
            <li>
              If we learn that an account belongs to a child under 12, we may disable the account
              and remove associated personal data where legally required.
            </li>
            <li>We may notify the parent or guardian where contact information is available.</li>
          </ul>
        </div>
      </section>

      {/* Child Safety Features */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">Child Safety Features</h2>

        <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-50">Content Guidelines</h3>
        <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
          Taatom prohibits content that harms or exploits children, including:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
          <li>Sexual, exploitative, or suggestive content involving minors.</li>
          <li>Bullying, harassment, or hate directed at children.</li>
          <li>Dangerous challenges or content encouraging self‑harm or risky behaviour.</li>
          <li>
            Sharing private information about a child (for example, exact address, school name,
            phone number).
          </li>
        </ul>
        <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
          Violations may result in immediate content removal, account suspension, or reporting to
          authorities where legally required.
        </p>

        <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">Reporting &amp; Moderation</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
          <li>
            Users can report posts, comments, or accounts for child safety concerns, harassment,
            nudity, self‑harm, spam, and more.
          </li>
          <li>Reports are reviewed by a moderation team and confirmed violations are removed.</li>
          <li>Repeat offenders may face stricter enforcement, including bans.</li>
        </ul>

        <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">Blocking &amp; Restrictions</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
          <li>
            Any user can block another account to stop direct messages, comments, and some
            interactions.
          </li>
          <li>Blocked users may be removed from followers/following where applicable.</li>
        </ul>
      </section>

      {/* Location & Privacy */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">Location &amp; Privacy</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
          <li>Location tagging on posts is optional.</li>
          <li>Users can choose whether to include location when posting.</li>
          <li>
            Accounts can be set to private so that posts are visible only to approved followers.
          </li>
          <li>
            We recommend that young users avoid sharing precise home or school addresses and review
            privacy settings regularly with a parent or guardian.
          </li>
        </ul>
      </section>

      {/* Parent & Reporting */}
      <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
        <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">
          Guidance for Parents &amp; Guardians
        </h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
          We encourage parents and guardians to:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
          <li>Review our Privacy Policy and Terms of Service.</li>
          <li>Help young users set a private account if appropriate.</li>
          <li>Discuss safe sharing practices with children.</li>
        </ul>
        <p className="mt-3 text-sm text-slate-700 dark:text-zinc-300">
          If you would like us to review or remove an account, contact us with the username or
          profile link and a brief explanation of your request.
        </p>
      </section>

      {/* How to Report & Contact */}
      <section className="rounded-3xl border border-emerald-200/80 bg-emerald-50/90 p-6 shadow-soft dark:border-emerald-900/40 dark:bg-emerald-950/35 md:p-8">
        <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 md:text-xl">
          How to Report Child Safety Concerns
        </h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-emerald-900 dark:text-emerald-100/90">
          <li>Report the content in the app using the built‑in report tools.</li>
          <li>Block the user if necessary.</li>
          <li>
            For urgent cases, email{" "}
            <a href="mailto:contact@taatom.com" className="font-semibold underline">
              contact@taatom.com
            </a>{" "}
            with links, usernames, and a short description of the concern.
          </li>
        </ol>

        <p className="mt-3 text-sm text-emerald-900 dark:text-emerald-100/90">
          We will review and respond as quickly as possible and escalate serious concerns to the
          appropriate authorities when required.
        </p>
      </section>
    </div>
  );
}


