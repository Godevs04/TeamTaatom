"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Sun, Moon, Monitor } from "lucide-react";
import { useSettings } from "../../../../hooks/useSettings";
import { Skeleton } from "../../../../components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "../../../../lib/utils";

function themeToNextThemes(value: "light" | "dark" | "auto") {
  return value === "auto" ? "system" : value;
}

const themeOptions: { value: "light" | "dark" | "auto"; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "auto", label: "System", icon: Monitor },
];

export default function AppearanceSettingsPage() {
  const { setTheme } = useTheme();
  const { settings, isLoading, updateCategory, isUpdating } = useSettings();
  const updatingRef = useRef<Set<string>>(new Set());
  const savedTheme = (settings?.account?.theme as "light" | "dark" | "auto") ?? "auto";

  useEffect(() => {
    if (!isLoading && savedTheme) setTheme(themeToNextThemes(savedTheme));
  }, [isLoading, savedTheme, setTheme]);

  const handleUpdate = useCallback(
    async (value: "light" | "dark" | "auto") => {
      if (updatingRef.current.has("theme")) return;
      updatingRef.current.add("theme");
      try {
        await updateCategory("account", { theme: value });
        setTheme(themeToNextThemes(value));
        toast.success("Theme updated");
      } catch {
        toast.error("Failed to update theme");
      } finally {
        updatingRef.current.delete("theme");
      }
    },
    [updateCategory, setTheme]
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-56 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Settings
      </Link>

      <div className="overflow-hidden rounded-3xl border border-border/80 bg-card shadow-soft dark:shadow-card">
        <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-6 py-6 md:px-8 md:py-7">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Appearance & Theme</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Choose how the app looks.</p>
        </div>
        <div className="px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Theme</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Light, dark, or follow your system.</p>
            </div>
            <div className="flex shrink-0 rounded-2xl bg-muted/60 p-1.5 dark:bg-muted/40">
              <div className="flex gap-1 rounded-xl">
                {themeOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = savedTheme === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdate(opt.value)}
                      disabled={isUpdating}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
                        selected
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 dark:shadow-primary/30"
                          : "text-muted-foreground hover:bg-background/80 hover:text-foreground dark:hover:bg-background/60"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
