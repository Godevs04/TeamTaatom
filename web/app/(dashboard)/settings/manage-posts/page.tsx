"use client";

import Link from "next/link";
import { ArrowLeft, Library } from "lucide-react";

export default function ManagePostsSettingsPage() {
  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Manage Posts</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">View and restore archived or hidden posts.</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Library className="h-4 w-4" /> Archive and post management will be available here.
        </p>
      </div>
    </div>
  );
}
