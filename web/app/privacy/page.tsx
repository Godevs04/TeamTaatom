import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      {/* Hero / Header */}
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-6 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-8 md:px-10">
        <div className="max-w-3xl text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100/90">
            Privacy Policy
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Your privacy, protected by design.
          </h1>
          <p className="mt-4 text-sm text-slate-100/90">
            Taatom (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting
            your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
            your information when you use our mobile application and services.
          </p>
        </div>
      </div>

      <div className="space-y-6 md:space-y-8">
        {/* Information We Collect */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
            Information We Collect
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            We collect different types of information to provide and improve Taatom.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Personal Information</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>
                  <strong>Account Information</strong>: username, email address, full name, profile
                  picture.
                </li>
                <li>
                  <strong>Content</strong>: photos, videos, captions, location data, and other
                  content you post.
                </li>
                <li>
                  <strong>Device Information</strong>: device type, operating system, unique device
                  identifiers.
                </li>
                <li>
                  <strong>Location Data</strong>: GPS coordinates when you tag posts with location
                  (optional).
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Automatically Collected Information
              </h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                <li>
                  <strong>Usage Data</strong>: how you interact with the app, features used, time
                  spent.
                </li>
                <li>
                  <strong>Log Data</strong>: IP address, access times, app crashes, performance
                  data.
                </li>
                <li>
                  <strong>Cookies and Tracking</strong>: analytics data to improve app performance.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 text-sm text-emerald-900">
            <p className="font-semibold">App Tracking Transparency (iOS)</p>
            <p className="mt-1">
              We do not track users across third‑party apps or external websites without explicit
              user consent, in compliance with Apple App Tracking Transparency (ATT).
            </p>
          </div>
        </section>

        {/* How We Use Your Information */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">
            How We Use Your Information
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            We use the information we collect to operate and improve Taatom, including:
          </p>
          <ul className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Provide, maintain, and improve our services.
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Process and display your posts and content.
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Enable social features (likes, comments, follows).
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Send notifications about activity on your account.
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Respond to your support requests.
            </li>
            <li className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
              ✓ Detect and prevent fraud or abuse, and comply with legal obligations.
            </li>
          </ul>
        </section>

        {/* Information Sharing & Security */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
            <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Information Sharing</h2>
            <p className="mt-2 text-sm text-slate-600">
              We do <strong>not</strong> sell your personal information. We may share it:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>
                <strong>With Other Users</strong>: your public profile and posts are visible to
                other users.
              </li>
              <li>
                <strong>Service Providers</strong>: third‑party services that help us operate
                (hosting, analytics).
              </li>
              <li>
                <strong>Legal Requirements</strong>: when required by law or to protect our rights.
              </li>
              <li>
                <strong>Business Transfers</strong>: in connection with a merger, acquisition, or
                sale.
              </li>
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
            <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Data Security</h2>
            <p className="mt-2 text-sm text-slate-600">
              We implement technical and organisational measures to protect your data:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>🔒 Encryption of data in transit (HTTPS).</li>
              <li>🔒 Secure authentication and authorization.</li>
              <li>🔒 Regular security audits and updates.</li>
              <li>🔒 Access controls and employee training.</li>
            </ul>
          </div>
        </section>

        {/* Your Rights, Children, Transfers */}
        <section className="rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-slate-900 md:text-xl">Your Rights</h2>
          <p className="mt-2 text-sm text-slate-600">
            Depending on your region, you may have the right to:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>Access your personal data.</li>
            <li>Correct inaccurate data.</li>
            <li>Delete your account and data.</li>
            <li>Export your data.</li>
            <li>Opt‑out of certain data processing.</li>
            <li>Withdraw consent where applicable.</li>
          </ul>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Children&apos;s Privacy</h3>
          <p className="mt-1 text-sm text-slate-700">
            Our app is not intended for users under 12 years of age. We do not knowingly collect
            personal information from children under 12. If you believe we have collected
            information from a child, please contact us immediately.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">
            International Data Transfers
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            Your information may be transferred to and processed in countries other than your
            country of residence. We ensure appropriate safeguards are in place for such transfers.
          </p>

          <h3 className="mt-5 text-sm font-semibold text-slate-900">Changes to This Policy</h3>
          <p className="mt-1 text-sm text-slate-700">
            We may update this Privacy Policy from time to time. We will notify you of any changes
            by posting the new policy on this page and updating the &quot;Last Updated&quot; date.
          </p>
        </section>

        {/* Contact */}
        <section className="rounded-3xl border border-emerald-200/80 bg-emerald-50/90 p-6 shadow-soft md:p-8">
          <h2 className="text-lg font-semibold text-emerald-900 md:text-xl">Contact Us</h2>
          <p className="mt-2 text-sm text-emerald-900">
            If you have questions about this Privacy Policy, please contact us at:
          </p>
          <p className="mt-3 text-sm font-semibold text-emerald-900">
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


