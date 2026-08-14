"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import {
  ONBOARDING_LANGUAGES,
  ONBOARDING_OTHER_LANGUAGE_ID,
  ONBOARDING_MAX_LANGUAGES,
} from "../../lib/onboarding-options";

/** Same parsing/building logic as onboarding/languages/page.tsx -- kept in
 * sync so a languagesKnown array saved from either surface round-trips
 * identically through the other. */
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

const KNOWN_LANGUAGE_IDS = new Set(ONBOARDING_LANGUAGES.map((l) => l.id));

/** Reverses a flat languagesKnown array (a mix of ONBOARDING_LANGUAGES ids
 * and free-typed "other" strings) back into this picker's working state. */
function splitLanguagesKnown(value: string[]): { selected: string[]; otherText: string } {
  const selected = value.filter((v) => KNOWN_LANGUAGE_IDS.has(v));
  const otherText = value.filter((v) => !KNOWN_LANGUAGE_IDS.has(v)).join(", ");
  if (otherText) selected.push(ONBOARDING_OTHER_LANGUAGE_ID);
  return { selected, otherText };
}

type LanguagePickerProps = {
  /** Initial languagesKnown array. Only read on mount -- re-mount (e.g. via
   * a `key`) to reset the picker if the underlying value changes externally. */
  value: string[];
  onChange: (next: string[]) => void;
  maxLanguages?: number;
};

export function LanguagePicker({ value, onChange, maxLanguages = ONBOARDING_MAX_LANGUAGES }: LanguagePickerProps) {
  const [languageSearch, setLanguageSearch] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>(() => splitLanguagesKnown(value).selected);
  const [otherLanguagesText, setOtherLanguagesText] = React.useState<string>(
    () => splitLanguagesKnown(value).otherText
  );
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const otherOn = selected.includes(ONBOARDING_OTHER_LANGUAGE_ID);

  const languagesKnownPreview = React.useMemo(
    () => buildLanguagesKnown(selected, otherLanguagesText),
    [selected, otherLanguagesText]
  );

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;
  React.useEffect(() => {
    onChangeRef.current(languagesKnownPreview);
  }, [languagesKnownPreview]);

  const filteredLanguages = React.useMemo(() => {
    const q = languageSearch.trim().toLowerCase();
    if (!q) return ONBOARDING_LANGUAGES;
    return ONBOARDING_LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.id.replace(/_/g, " ").toLowerCase().includes(q)
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
    setValidationError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = buildLanguagesKnown([...prev, id], otherLanguagesText);
      if (next.length > maxLanguages) {
        setValidationError(`You can select up to ${maxLanguages} languages.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" aria-hidden />
        <Input
          value={languageSearch}
          onChange={(e) => setLanguageSearch(e.target.value)}
          placeholder="Search languages…"
          className="rounded-xl pl-10"
          autoCapitalize="off"
          autoCorrect="off"
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {languageSearch.trim() ? `Matches (${filteredLanguages.length})` : "All languages"}
        {languagesKnownPreview.length > 0 ? ` · ${languagesKnownPreview.length}/${maxLanguages} selected` : ""}
      </p>
      <div className="mt-2 flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
        {filteredLanguages.map((lang) => {
          const on = selected.includes(lang.id);
          return (
            <button
              key={lang.id}
              type="button"
              onClick={() => toggle(lang.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-left text-sm font-medium transition-colors",
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-slate-200 bg-slate-50/80 text-slate-800 hover:border-slate-300 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-200 dark:hover:border-zinc-600"
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
              "inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-sm font-medium transition-colors",
              otherOn
                ? "border-primary bg-primary/10 text-primary"
                : "border-dashed border-slate-300 bg-slate-50/80 text-slate-800 hover:border-slate-400 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-200"
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
          onChange={(e) => {
            setOtherLanguagesText(e.target.value);
            setValidationError(null);
          }}
          placeholder="e.g. Icelandic, American Sign Language — comma-separated"
          maxLength={300}
          className="mt-3 rounded-xl"
        />
      )}

      {validationError ? <p className="mt-2 text-xs text-red-600">{validationError}</p> : null}
    </div>
  );
}
