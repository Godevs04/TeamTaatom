"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveProfileOnboardingPreferences } from "@/lib/api";
import { ONBOARDING_COUNTRY_SHORTCUTS, ONBOARDING_OTHER_COUNTRY_ID } from "@/lib/onboarding-options";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export default function OnboardingNationalityPage() {
  const router = useRouter();
  const [countrySearch, setCountrySearch] = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const filteredCountries = React.useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return ONBOARDING_COUNTRY_SHORTCUTS;
    return ONBOARDING_COUNTRY_SHORTCUTS.filter((c) => {
      if (c.id === ONBOARDING_OTHER_COUNTRY_ID) {
        return !q || q.includes("other") || c.label.toLowerCase().includes(q);
      }
      return c.label.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    });
  }, [countrySearch]);

  const onShortcutCountry = (label: string, id: string) => {
    if (id === ONBOARDING_OTHER_COUNTRY_ID) {
      setNationality("");
      return;
    }
    setNationality(label);
  };

  const onContinue = async () => {
    setSaving(true);
    try {
      await saveProfileOnboardingPreferences({ nationality: nationality.trim() });
      router.replace("/onboarding/interests");
    } catch {
      toast.error("Could not save. You can continue and try again from settings later.");
      router.replace("/onboarding/interests");
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => router.replace("/onboarding/interests");

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 3 of 5</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">Nationality / country</h1>
      <p className="mt-2 text-sm text-slate-600">
        Search for a country shortcut or type freely. Tap <span className="font-semibold">Other</span> if your place is not in the
        list.
      </p>

      <div className="relative mt-6">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          placeholder="Search countries…"
          className="h-12 rounded-xl border-slate-200/90 bg-slate-50/80 pl-10"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <p className="mt-6 text-sm font-semibold text-slate-800">Your nationality or country</p>
      <Input
        value={nationality}
        onChange={(e) => setNationality(e.target.value)}
        placeholder="Type here or pick a shortcut below"
        maxLength={100}
        className="mt-2 h-12 rounded-xl border-slate-200/90 bg-slate-50/80"
      />

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Shortcuts {countrySearch.trim() ? `(${filteredCountries.length})` : ""}
      </p>
      <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {filteredCountries.map((c) => {
          const dim = c.id !== ONBOARDING_OTHER_COUNTRY_ID && nationality === c.label;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onShortcutCountry(c.label, c.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                dim ? "border-primary bg-primary/10 text-primary" : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>

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
