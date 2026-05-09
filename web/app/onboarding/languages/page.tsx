"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProfileOnboardingPreferences } from "@/lib/api";
import { ONBOARDING_LANGUAGES, ONBOARDING_OTHER_LANGUAGE_ID } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";
import { Check, Search } from "lucide-react";

function parseOtherLanguages(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildLanguagesKnown(selected: string[], otherText: string): string[] {
  const preset = selected.filter((id) => id !== ONBOARDING_OTHER_LANGUAGE_ID);
  return [...preset, ...parseOtherLanguages(otherText)];
}

export default function OnboardingLanguagesPage() {
  const router = useRouter();
  const [languageSearch, setLanguageSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [otherLanguagesText, setOtherLanguagesText] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const otherOn = selected.includes(ONBOARDING_OTHER_LANGUAGE_ID);

  const filteredLanguages = React.useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return ONBOARDING_LANGUAGES;
    return ONBOARDING_LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.id.replace(/_/g, " ").toLowerCase().includes(q),
    );
  }, [languageSearch]);

  const showOtherChip = React.useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q || otherOn) return true;
    return (
      q.includes("other") ||
      q.includes("specify") ||
      q.includes("custom") ||
      filteredLanguages.length === 0
    );
  }, [languageSearch, otherOn, filteredLanguages.length]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onContinue = async () => {
    setSaving(true);
    try {
      const languagesKnown = buildLanguagesKnown(selected, otherLanguagesText);
      await saveProfileOnboardingPreferences({ languagesKnown });
      router.replace("/onboarding/nationality");
    } catch {
      toast.error("Could not save. You can continue and try again from settings later.");
      router.replace("/onboarding/nationality");
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => router.replace("/onboarding/nationality");

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 2 of 5</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">Languages you speak</h1>
      <p className="mt-2 text-sm text-slate-600">
        Search to find a language quickly. If yours is missing, pick <span className="font-semibold">Other (specify)</span> and type
        it.
      </p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          value={languageSearch}
          onChange={(e) => setLanguageSearch(e.target.value)}
          placeholder="Search languages…"
          className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80 pl-10"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <p className="mt-6 text-sm font-semibold text-slate-800">
        {languageSearch.trim() ? `Matches (${filteredLanguages.length})` : "All languages"}
      </p>
      <div className="mt-3 flex max-h-[min(50vh,28rem)] flex-wrap gap-2 overflow-y-auto pr-1">
        {filteredLanguages.map((lang) => {
          const on = selected.includes(lang.id);
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => toggle(lang.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-left text-sm font-medium transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300",
              )}
            >
              {on && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
              {lang.label}
            </button>
          );
        })}
        {showOtherChip && (
          <button
            type="button"
            onClick={() => toggle(ONBOARDING_OTHER_LANGUAGE_ID)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-medium transition-colors",
              otherOn
                ? "border-primary bg-primary/10 text-primary"
                : "border-dashed border-slate-300 bg-slate-50/80 text-slate-800 hover:border-slate-400",
            )}
          >
            {otherOn && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />}
            Other (specify)
          </button>
        )}
      </div>

      {otherOn && (
        <Input
          value={otherLanguagesText}
          onChange={(e) => setOtherLanguagesText(e.target.value)}
          placeholder="e.g. Icelandic, American Sign Language — comma-separated"
          maxLength={300}
          className="mt-3 min-h-[72px] rounded-xl border-slate-200/90 bg-slate-50/80 py-3"
        />
      )}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="rounded-xl font-semibold text-slate-600" onClick={onSkip}>
          Skip
        </Button>
        <Button type="button" className="h-12 rounded-xl font-semibold sm:min-w-[140px]" disabled={saving} onClick={onContinue}>
          {saving ? "Saving…" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
