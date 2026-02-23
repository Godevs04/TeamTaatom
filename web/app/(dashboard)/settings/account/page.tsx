"use client";

import { useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Sun, Moon, Monitor, Gauge, Wifi, WifiHigh, Globe } from "lucide-react";
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

const dataOptions: { value: "low" | "medium" | "high"; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "low", label: "Low", icon: Gauge, hint: "Save data" },
  { value: "medium", label: "Medium", icon: Wifi, hint: "Balanced" },
  { value: "high", label: "High", icon: WifiHigh, hint: "Best quality" },
];

export default function AccountSettingsPage() {
  const { setTheme } = useTheme();
  const { settings, isLoading, updateCategory, isUpdating } = useSettings();
  const updatingRef = useRef<Set<string>>(new Set());

  const account = settings?.account ?? {};
  const savedTheme = (account.theme as "light" | "dark" | "auto") ?? "auto";

  useEffect(() => {
    if (!isLoading && savedTheme) setTheme(themeToNextThemes(savedTheme));
  }, [isLoading, savedTheme, setTheme]);

  const handleUpdate = useCallback(
    async (key: string, value: unknown) => {
      if (updatingRef.current.has(key)) return;
      updatingRef.current.add(key);
      try {
        await updateCategory("account", { [key]: value });
        if (key === "theme" && typeof value === "string") setTheme(themeToNextThemes(value as "light" | "dark" | "auto"));
        toast.success("Setting updated");
      } catch {
        toast.error("Failed to update setting");
      } finally {
        updatingRef.current.delete(key);
      }
    },
    [updateCategory, setTheme]
  );

  const theme = savedTheme;
  const dataUsage = (account.dataUsage as "low" | "medium" | "high") ?? "medium";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Settings
        </Link>
        <Skeleton className="h-80 w-full rounded-3xl" />
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
        {/* Header with subtle gradient accent */}
        <div className="border-b border-border/60 bg-gradient-to-b from-muted/30 to-transparent px-6 py-6 md:px-8 md:py-7">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Account</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Profile info, language, and account preferences.
          </p>
        </div>

        <div className="space-y-0 divide-y divide-border/60">
          {/* Theme */}
          <section className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Theme</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Choose light, dark, or follow your system.</p>
              </div>
              <div className="flex shrink-0 rounded-2xl bg-muted/60 p-1.5 dark:bg-muted/40">
                <div className="flex gap-1 rounded-xl">
                  {themeOptions.map((opt) => {
                    const Icon = opt.icon;
                    const selected = theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUpdate("theme", opt.value)}
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
          </section>

          {/* Data usage */}
          <section className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">Data usage</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">Prefer lower or higher quality for media.</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {dataOptions.map((opt) => {
                  const Icon = opt.icon;
                  const selected = dataUsage === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleUpdate("dataUsage", opt.value)}
                      disabled={isUpdating}
                      title={opt.hint}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50",
                        selected
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 dark:shadow-primary/30"
                          : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground dark:bg-muted/30 dark:hover:bg-primary/10"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Language */}
          <section className="px-6 py-6 md:px-8 md:py-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground dark:bg-muted/40">
                  <Globe className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Language</h3>
                  <p className="text-sm text-muted-foreground">English only · more coming soon</p>
                </div>
              </div>
              <span className="inline-flex rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                English
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
