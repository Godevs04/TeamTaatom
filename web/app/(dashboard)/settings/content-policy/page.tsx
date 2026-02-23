"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ContentPolicySettingsPage() {
  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Community Guidelines</h2>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Safety policy, content rules, and how to report or block. We expect respectful behaviour and safe content. Violations may result in content removal or account action.
        </p>
      </div>
    </div>
  );
}
