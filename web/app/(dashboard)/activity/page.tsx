"use client";

import { Activity } from "lucide-react";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Activity Feed</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">See what your friends are up to.</p>
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Activity className="h-4 w-4" /> Activity feed coming soon.
        </p>
      </div>
    </div>
  );
}
