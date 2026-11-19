import React from "react";
import Link from "next/link";
import { ArrowLeft, Download, MapPinned, ShieldCheck, Smartphone, Users, Zap } from "lucide-react";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Download Taatom for iOS & Android",
  description:
    "Install Taatom on iPhone or Android for trip journaling, Navigate tracking, Shorts, Connect communities, and privacy-first travel storytelling. Full feature overview and FAQs.",
  path: "/download",
});

export default function DownloadPage() {
  const googlePlayUrl =
    "https://play.google.com/store/apps/details?id=com.taatom.app&pcampaignid=web_share";
  const appStoreUrl = "https://apps.apple.com/app/id6757185352";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950">
      <div className="mx-auto w-full max-w-5xl space-y-6 px-3 py-6 sm:px-4 sm:py-10 md:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-8 text-center shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-12 md:px-10">
          <div className="mx-auto max-w-2xl text-slate-50">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
              Get the App
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              Download Taatom for iOS and Android
            </h1>
            <p className="mt-4 text-base text-slate-100/90 sm:text-lg">
              Journal trips with photos, Shorts, and place context. Follow creators, join Connect
              communities, and use Navigate when companions need your live route. The web app works
              in the browser; mobile unlocks the fullest camera and background GPS experience.
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col items-center justify-between rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
                <Smartphone className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Apple iOS</h2>
              <p className="mx-auto max-w-sm text-sm text-slate-600 dark:text-zinc-400">
                Optimized for iPhone with smooth capture flows, notifications, and map-friendly
                journaling on the go.
              </p>
            </div>
            <a
              href={appStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-slate-50 shadow-lg transition-colors hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              <Download className="h-4 w-4" />
              Download on the App Store
            </a>
          </div>

          <div className="flex flex-col items-center justify-between rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Smartphone className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Google Android</h2>
              <p className="mx-auto max-w-sm text-sm text-slate-600 dark:text-zinc-400">
                Built for Android devices with background-friendly Navigate sessions and fast
                notification updates while you travel.
              </p>
            </div>
            <a
              href={googlePlayUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" />
              Get it on Google Play
            </a>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h2 className="mb-2 text-center text-lg font-bold text-slate-900 dark:text-zinc-50">
            What you can do in the Taatom app
          </h2>
          <p className="mx-auto mb-6 max-w-3xl text-center text-sm text-slate-600 dark:text-zinc-400">
            Taatom is a travel storytelling platform. Install the app when you want the best capture
            tools; use the website to browse places, public trips, guides, and policies without
            installing anything.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Realtime Navigate sessions",
                body: "Share a live route with companions while you are moving, then end the session when you reunite.",
              },
              {
                icon: Smartphone,
                title: "Posts, Shorts, and long videos",
                body: "Document days with stills, vertical Shorts, and longer walks that keep place context attached.",
              },
              {
                icon: ShieldCheck,
                title: "Privacy controls",
                body: "Choose public, followers, or private visibility per post and manage profile discovery settings.",
              },
              {
                icon: MapPinned,
                title: "Places and TripScore",
                body: "Tag destinations carefully and grow a personal travel map based on what you actually journaled.",
              },
              {
                icon: Users,
                title: "Connect communities",
                body: "Follow creator pages, join group chats, and share community links with clear moderation norms.",
              },
              {
                icon: Download,
                title: "Works with the web",
                body: "Public locale pages, trip links, About, Help, and Guides stay available at taatom.com for everyone.",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col items-start space-y-2 text-left">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-zinc-50">{item.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">Download FAQs</h2>
          <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-700 dark:text-zinc-300">
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-zinc-50">Do I need the app to browse Taatom?</h3>
              <p className="mt-1">
                No. You can explore places, public trips,{" "}
                <Link href="/guides" className="font-medium text-sky-700 underline dark:text-sky-300">
                  guides
                </Link>
                , and policies on the website. The app is best for capturing media and background
                Navigate sessions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-zinc-50">Is Taatom free?</h3>
              <p className="mt-1">
                Creating an account and journaling trips is free. Optional Connect subscriptions and
                creator programs have their own terms shown in-product before you pay or enroll.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-zinc-50">Where do I get help after installing?</h3>
              <p className="mt-1">
                Start with the{" "}
                <Link href="/help" className="font-medium text-sky-700 underline dark:text-sky-300">
                  Help center
                </Link>{" "}
                or{" "}
                <Link href="/contact" className="font-medium text-sky-700 underline dark:text-sky-300">
                  contact support
                </Link>
                . Read{" "}
                <Link href="/privacy" className="font-medium text-sky-700 underline dark:text-sky-300">
                  Privacy
                </Link>{" "}
                and{" "}
                <Link
                  href="/community-guidelines"
                  className="font-medium text-sky-700 underline dark:text-sky-300"
                >
                  Community Guidelines
                </Link>{" "}
                before publishing.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
