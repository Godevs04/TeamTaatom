import React from "react";
import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck, Smartphone, Zap } from "lucide-react";

export const metadata = {
  title: "Download Taatom - Premium Travel & Social App",
  description: "Get the Taatom app for Android and iOS. Explore, share, and navigate your travel journeys with a premium social experience.",
};

export default function DownloadPage() {
  const googlePlayUrl = "https://play.google.com/store/search?q=taatom&c=apps&hl=en";
  const appStoreUrl = "https://apps.apple.com/app/id6757185352";

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
      <div className="overflow-hidden rounded-[28px] bg-gradient-to-r from-sky-600 via-indigo-600 to-emerald-500 px-5 py-8 shadow-2xl shadow-slate-900/25 sm:px-8 sm:py-12 md:px-10 text-center">
        <div className="max-w-2xl mx-auto text-slate-50">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/90">
            Get the App
          </p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
            Taatom is Mobile-First
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-100/90">
            Experience premium traveling, navigation tracking, and social interaction at its best. Download the app today.
          </p>
        </div>
      </div>

      {/* Download Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* iOS Card */}
        <div className="flex flex-col items-center justify-between p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-900 dark:bg-zinc-800 dark:text-zinc-100">
              <Smartphone className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Apple iOS</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">
              Optimized for iPhone with premium widget support, smooth haptics, and Apple Maps integration.
            </p>
          </div>
          <a
            href={appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-slate-50 hover:bg-slate-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 px-6 py-3.5 text-sm font-semibold shadow-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Download on the App Store
          </a>
        </div>

        {/* Android Card */}
        <div className="flex flex-col items-center justify-between p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900 text-center">
          <div className="space-y-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <Smartphone className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">Google Android</h2>
            <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">
              Optimized for Android devices, featuring seamless background GPS tracking and instant notification updates.
            </p>
          </div>
          <a
            href={googlePlayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-500 px-6 py-3.5 text-sm font-semibold shadow-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Get it on Google Play
          </a>
        </div>
      </div>

      {/* Trust & Features Section */}
      <section className="p-6 sm:p-8 rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="text-lg font-bold text-slate-900 dark:text-zinc-50 text-center mb-6">Why download the Taatom app?</h3>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-sky-100 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-zinc-50">Realtime Tracking</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Map your journeys and trips in real-time with precise location updates.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-zinc-50">Social Feed</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Share posts, watch video shorts, and message fellow travelers on the go.
            </p>
          </div>
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="h-10 w-10 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-zinc-50">Privacy First</h4>
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Complete control over your visibility, routes, and account permissions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
