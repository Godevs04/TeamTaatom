"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveProfileOnboardingPreferences } from "@/lib/api";
import { ONBOARDING_INTERESTS } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export default function OnboardingInterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const goSuggested = () => router.replace("/onboarding/suggested-users");

  const onContinue = async () => {
    if (selected.length === 0) {
      goSuggested();
      return;
    }
    setSaving(true);
    try {
      await saveProfileOnboardingPreferences({ interests: selected });
      goSuggested();
    } catch {
      toast.error("Could not save interests. Continuing…");
      goSuggested();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 5 of 6</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">What interests you?</h1>
      <p className="mt-2 text-sm text-slate-600">Select a few to personalize your feed.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {ONBOARDING_INTERESTS.map((item) => {
          const on = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300",
              )}
            >
              {on && <Check className="h-3.5 w-3.5" aria-hidden />}
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="rounded-xl font-semibold text-slate-600" onClick={goSuggested}>
          Skip
        </Button>
        <Button type="button" className="h-12 rounded-xl font-semibold sm:min-w-[160px]" disabled={saving} onClick={onContinue}>
          {saving ? "Saving…" : `Continue (${selected.length})`}
        </Button>
      </div>
    </div>
  );
}
