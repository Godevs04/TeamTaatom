"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";

export default function ContactSupportSettingsPage() {
  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Contact Support</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Get help from our team.</p>
        <a
          href="mailto:support@example.com"
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300 dark:hover:bg-zinc-700"
        >
          <Mail className="h-4 w-4" /> support@example.com
        </a>
      </div>
    </div>
  );
}
