"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSettings } from "../../../../hooks/useSettings";
import { Button } from "../../../../components/ui/button";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";

export default function DataSettingsPage() {
  const { settings, isLoading, updateCategory, isUpdating } = useSettings();
  const updatingRef = useRef<Set<string>>(new Set());
  const dataUsage = (settings?.account?.dataUsage as "low" | "medium" | "high") ?? "medium";

  const handleUpdate = useCallback(
    async (value: "low" | "medium" | "high") => {
      if (updatingRef.current.has("dataUsage")) return;
      updatingRef.current.add("dataUsage");
      try {
        await updateCategory("account", { dataUsage: value });
        toast.success("Data usage preference updated");
      } catch {
        toast.error("Failed to update");
      } finally {
        updatingRef.current.delete("dataUsage");
      }
    },
    [updateCategory]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-48 w-full rounded-[1.75rem]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white/90 shadow-premium backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/70">
        <div className="border-b border-slate-200/70 bg-gradient-to-b from-slate-50/80 to-transparent px-5 py-6 md:px-8 md:py-7 dark:border-zinc-800/70 dark:from-zinc-800/40">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900 dark:text-white md:text-3xl">Data & Storage</h2>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Prefer lower or higher quality for media to save data.</p>
        </div>
        <div className="flex flex-wrap gap-2 px-5 py-6 md:px-8 md:py-7">
          {(["low", "medium", "high"] as const).map((d) => (
            <Button
              key={d}
              variant={dataUsage === d ? "default" : "outline"}
              size="sm"
              onClick={() => handleUpdate(d)}
              disabled={isUpdating}
            >
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
