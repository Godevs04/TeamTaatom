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
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Settings
      </Link>
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-soft backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/95 md:p-6">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white md:text-2xl">Data & Storage</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Prefer lower or higher quality for media to save data.</p>
        <div className="mt-6 flex flex-wrap gap-2">
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
