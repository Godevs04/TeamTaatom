import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Hero / Header */}
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8 md:px-10">
        <div className="max-w-3xl text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
            Terms of Service
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            The rules for using Taatom.
          </h1>
          <p className="mt-4 text-sm text-slate-100/90">
            By accessing or using Taatom (&quot;the App&quot;), you agree to be bound by these Terms
            of Service. If you disagree with any part of these Terms, you may not access the App.
          </p>
        </div>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Agreement & Description */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">Agreement to Terms</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
            By using Taatom, you agree to these Terms of Service (&quot;Terms&quot;). You should
            read them carefully before using the App.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-zinc-50">Description of Service</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
            Taatom is a social media platform that allows you to:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>Share photos and videos with location tags.</li>
            <li>Connect with other users through follows, likes, and comments.</li>
            <li>Discover travel destinations and experiences.</li>
            <li>Create and manage collections of posts.</li>
          </ul>
        </section>

        {/* User Accounts */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">User Accounts</h2>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-50">Account Creation</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>You must be at least 12 years old to use the App.</li>
            <li>You must provide accurate and complete information.</li>
            <li>You are responsible for maintaining account security.</li>
            <li>Only one account per person is allowed.</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">Account Responsibilities</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>You are responsible for all activity under your account.</li>
            <li>You must not share your account credentials.</li>
            <li>You must notify us immediately of any unauthorized access.</li>
            <li>We may suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </section>

        {/* User Content */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">User Content</h2>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-50">Content Ownership</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>You retain ownership of the content you post.</li>
            <li>
              By posting, you grant us a license to use, display, and distribute your content in
              connection with operating Taatom.
            </li>
            <li>You represent that you have the right to post the content you share.</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">Content Guidelines</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
            You agree not to post content that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>Violates any law or regulation.</li>
            <li>Infringes on intellectual property rights.</li>
            <li>Contains hate speech, harassment, or threats.</li>
            <li>Is pornographic, sexually explicit, or excessively violent.</li>
            <li>Promotes illegal activities.</li>
            <li>Contains spam or misleading information.</li>
            <li>Violates others&apos; privacy.</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">Content Moderation</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>We may review, modify, or remove any content at our discretion.</li>
            <li>We may suspend or ban accounts that repeatedly violate these guidelines.</li>
          </ul>
        </section>

        {/* Copyright & Prohibited Activities */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">
            Copyright &amp; Intellectual Property
          </h2>
          <h3 className="mt-3 text-sm font-semibold text-slate-900 dark:text-zinc-50">Your Responsibility</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>
              You are solely responsible for ensuring you have rights to use any content you post.
            </li>
            <li>You must not post copyrighted material without permission.</li>
            <li>
              You agree to indemnify us against copyright claims related to content you upload.
            </li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-zinc-50">Prohibited Activities</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">You agree not to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>Use the App for any illegal purpose.</li>
            <li>Attempt to gain unauthorized access to the App or other users&apos; accounts.</li>
            <li>Interfere with or disrupt the App&apos;s operation.</li>
            <li>Use automated systems (bots, scrapers) without permission.</li>
            <li>Reverse engineer or attempt to extract source code.</li>
            <li>Impersonate others or provide false information.</li>
          </ul>
        </section>

        {/* Termination & Disclaimers */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 dark:border-zinc-800/80 dark:bg-zinc-900/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl dark:text-zinc-50">Termination</h2>
          <p className="mt-2 text-sm text-slate-700 dark:text-zinc-300">
            We may terminate or suspend your account immediately, without prior notice, if you:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-zinc-300">
            <li>Violate these Terms.</li>
            <li>Engage in illegal activity, fraud, or abuse.</li>
            <li>Otherwise misuse the App in a way that harms other users or Taatom.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-700 dark:text-zinc-300">
            Upon termination, your right to use the App ceases immediately. We may delete your
            account and content, but you remain liable for obligations incurred before termination.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-slate-900 dark:text-zinc-50">Disclaimers</h3>
          <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
            Taatom is provided &quot;as is&quot; and &quot;as available&quot;, without warranties
            of any kind. We do not guarantee that the App will be uninterrupted, secure, or
            error‑free.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-3xl border border-indigo-200/80 bg-indigo-50/90 p-6 shadow-soft dark:border-indigo-900/40 dark:bg-indigo-950/35 md:p-8">
          <h2 className="text-lg font-semibold text-indigo-900 dark:text-indigo-100 md:text-xl">Contact</h2>
          <p className="mt-2 text-sm text-indigo-900 dark:text-indigo-100/90">
            For questions about these Terms or legal communication, contact us at:
          </p>
          <p className="mt-3 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
            Email:{" "}
            <a href="mailto:contact@taatom.com" className="underline">
              contact@taatom.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}


