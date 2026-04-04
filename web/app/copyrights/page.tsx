import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function CopyrightsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Hero */}
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8 md:px-10">
        <div className="max-w-3xl text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
            Copyright Consent &amp; User Responsibility
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Respect for creators, built in.
          </h1>
          <p className="mt-4 text-sm text-slate-100/90">
            Taatom is a platform for sharing user‑generated content. This page explains your
            responsibilities regarding copyright and intellectual property when using our service.
          </p>
        </div>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Your responsibilities */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
            Your Copyright Responsibilities
          </h2>

          <h3 className="mt-3 text-sm font-semibold text-slate-900">When Posting Content</h3>
          <p className="mt-1 text-sm text-slate-700">
            By uploading content to Taatom, you confirm that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>You own the content you upload, or have obtained all necessary rights.</li>
            <li>
              Any music, audio, or media in your posts is your original creation, licensed for your
              use, in the public domain, or used with explicit permission from the copyright holder.
            </li>
            <li>
              You will not post copyrighted material without authorization, and you understand that
              doing so may violate copyright law.
            </li>
          </ul>
        </section>

        {/* Taatom's position */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Taatom&apos;s Position</h2>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">
            We Do Not Provide Copyrighted Music
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Taatom does not provide or license copyrighted music for use in your posts.</li>
            <li>Taatom currently does not provide a licensed music library.</li>
            <li>You are responsible for ensuring you have rights to any audio you use.</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">Platform Responsibility</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Taatom is not responsible for copyright violations in user‑uploaded content and does
              not pre‑review content for copyright compliance.
            </li>
            <li>You are solely liable for any copyright infringement related to your posts.</li>
          </ul>
        </section>

        {/* Violations & reporting */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
            What Happens If You Violate Copyright
          </h2>
          <h3 className="mt-3 text-sm font-semibold text-slate-900">Content Removal</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              If we receive a valid copyright complaint (for example, a DMCA takedown notice), we
              may remove the infringing content.
            </li>
            <li>We may notify you of the removal and review repeat violations.</li>
            <li>Repeated infringement may result in suspension or termination of your account.</li>
          </ul>

          <h3 className="mt-4 text-sm font-semibold text-slate-900">Legal Consequences</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Copyright holders may pursue legal action directly against you.</li>
            <li>
              You may be liable for damages, legal fees, and other costs related to infringement.
            </li>
            <li>Taatom will cooperate with valid legal requests when required by law.</li>
          </ul>
        </section>

        {/* Reporting & best practices */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
            How to Report Copyright Infringement
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            If you believe your copyright has been infringed on Taatom:
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>
              <strong>Contact Us</strong> at{" "}
              <a href="mailto:contact@taatom.com" className="text-primary underline">
                contact@taatom.com
              </a>{" "}
              with:
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>A description of the copyrighted work.</li>
                <li>Where the infringing content appears in Taatom (links, screenshots).</li>
                <li>Your contact information.</li>
              </ul>
            </li>
            <li>
              <strong>DMCA Takedown Notice</strong> (if applicable): submit a formal notice with all
              required information. We will process valid notices promptly.
            </li>
          </ol>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Best Practices</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Use original content whenever possible.</li>
            <li>
              Use properly licensed content (for example, royalty‑free or Creative Commons
              materials) and respect license terms.
            </li>
            <li>Get explicit permission from rights holders if you are unsure.</li>
          </ul>
        </section>

        {/* Contact */}
        <section className="rounded-3xl border border-rose-200/80 bg-rose-50/90 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-rose-900 md:text-xl">Contact</h2>
          <p className="mt-2 text-sm text-rose-900">
            For copyright communication or questions about this page, contact:
          </p>
          <p className="mt-3 text-sm font-semibold text-rose-900">
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


