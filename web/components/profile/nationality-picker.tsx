"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import { ONBOARDING_COUNTRY_SHORTCUTS, ONBOARDING_OTHER_COUNTRY_ID } from "../../lib/onboarding-options";

type NationalityPickerProps = {
  value: string;
  onChange: (next: string) => void;
};

/** Same country-shortcut picker as onboarding/nationality/page.tsx, minus
 * the onboarding chrome (step header, required-field validation, Continue
 * button) -- here it's just one optional field among several. */
export function NationalityPicker({ value, onChange }: NationalityPickerProps) {
  const [countrySearch, setCountrySearch] = React.useState("");

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
      onChange("");
      return;
    }
    onChange(label);
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" aria-hidden />
        <Input
          value={countrySearch}
          onChange={(e) => setCountrySearch(e.target.value)}
          placeholder="Search countries…"
          className="rounded-xl pl-10"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type here or pick a shortcut below"
        maxLength={100}
        className="mt-2 rounded-xl"
      />

      <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
        {filteredCountries.map((c) => {
          const active = c.id !== ONBOARDING_OTHER_COUNTRY_ID && value === c.label;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onShortcutCountry(c.label, c.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
