"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function TermsSettingsPage() {
  return (
    <div className="space-y-8">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70">
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">Terms & Conditions</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Legal terms and platform usage basics.</p>
        </div>
        <div className="px-5 py-6 md:px-8 md:py-7">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            By using this service you agree to our user agreement and content policy. Please read the full terms on our legal page.
          </p>
        </div>
      </div>
    </div>
  );
}
