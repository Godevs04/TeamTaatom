"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Search, X } from "lucide-react";
import { getLocaleCountries, getLocaleStates } from "../../lib/api";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

/** Mobile locale.tsx spotTypeOptions — the fixed set shown in the filter modal. */
export const LOCALE_SPOT_TYPES = [
  "Historical spots",
  "Cultural spots",
  "Natural spots",
  "Adventure spots",
  "Religious/spiritual spots",
] as const;

export type LocaleFilters = {
  countryCode: string;
  countryName: string;
  /** Value sent as `stateCode` (may be empty when the backend only has a province name). */
  stateCode: string;
  stateProvince: string;
  spotTypes: string[];
  /** Kilometres; empty = no radius limit. */
  searchRadius: string;
};

export const EMPTY_LOCALE_FILTERS: LocaleFilters = {
  countryCode: "",
  countryName: "",
  stateCode: "",
  stateProvince: "",
  spotTypes: [],
  searchRadius: "",
};

export function countActiveFilters(filters: LocaleFilters): number {
  return (
    (filters.countryCode ? 1 : 0) +
    (filters.stateCode || filters.stateProvince ? 1 : 0) +
    filters.spotTypes.length +
    (filters.searchRadius.trim() ? 1 : 0)
  );
}

function SearchableList<T>({
  items,
  getKey,
  getLabel,
  selectedKey,
  onSelect,
  placeholder,
  disabled,
  emptyLabel,
}: {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  selectedKey: string;
  onSelect: (item: T | null) => void;
  placeholder: string;
  disabled?: boolean;
  emptyLabel: string;
}) {
  const [query, setQuery] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => getLabel(item).toLowerCase().includes(q)) : items;
  }, [getLabel, items, query]);

  return (
    <div className={cn("rounded-xl border border-slate-200 dark:border-zinc-700", disabled && "opacity-50")}>
      <div className="relative border-b border-slate-200 dark:border-zinc-700">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-t-xl bg-transparent py-2 pl-9 pr-3 text-sm outline-none"
        />
      </div>
      <ul className="max-h-40 overflow-y-auto py-1" role="listbox">
        <li>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(null)}
            className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-zinc-800", !selectedKey && "font-semibold text-primary")}
          >
            All
            {!selectedKey ? <Check className="h-4 w-4" /> : null}
          </button>
        </li>
        {filtered.length === 0 ? (
          <li className="px-3 py-2 text-xs text-slate-500">{emptyLabel}</li>
        ) : (
          filtered.map((item) => {
            const key = getKey(item);
            const selected = key === selectedKey;
            return (
              <li key={key}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(item)}
                  className={cn("flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-zinc-800", selected && "font-semibold text-primary")}
                  role="option"
                  aria-selected={selected}
                >
                  <span className="truncate">{getLabel(item)}</span>
                  {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

type Country = { code: string; name?: string; localeCount?: number };
type StateOption = { stateCode: string; stateProvince: string };

/** Filter modal mirroring mobile locale.tsx (country, state, spot types, search radius). */
export function LocaleFilterModal({
  open,
  initial,
  hasLocation,
  onClose,
  onApply,
}: {
  open: boolean;
  initial: LocaleFilters;
  hasLocation: boolean;
  onClose: () => void;
  onApply: (filters: LocaleFilters) => void;
}) {
  const [draft, setDraft] = React.useState<LocaleFilters>(initial);
  React.useEffect(() => {
    if (open) setDraft(initial);
  }, [initial, open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  const countriesQ = useQuery({ queryKey: ["locale-countries"], queryFn: getLocaleCountries, enabled: open });
  const statesQ = useQuery({
    queryKey: ["locale-states", draft.countryCode],
    queryFn: () => getLocaleStates(draft.countryCode),
    enabled: open && !!draft.countryCode,
  });

  if (!open) return null;
  const count = countActiveFilters(draft);
  const toggleSpot = (spot: string) =>
    setDraft((d) => ({
      ...d,
      spotTypes: d.spotTypes.includes(spot) ? d.spotTypes.filter((s) => s !== spot) : [...d.spotTypes, spot],
    }));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locale-filter-title"
        className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-xl dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="locale-filter-title" className="text-lg font-semibold text-slate-900 dark:text-zinc-50">
            Filters
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm font-medium text-primary hover:underline"
              onClick={() => setDraft(EMPTY_LOCALE_FILTERS)}
            >
              Clear
            </button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onClose} aria-label="Close filters">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">Country</p>
            <SearchableList<Country>
              items={countriesQ.data?.countries ?? []}
              getKey={(c) => c.code}
              getLabel={(c) => `${c.name ?? c.code}${c.localeCount != null ? ` (${c.localeCount})` : ""}`}
              selectedKey={draft.countryCode}
              onSelect={(c) =>
                setDraft((d) => ({
                  ...d,
                  countryCode: c?.code ?? "",
                  countryName: c?.name ?? "",
                  stateCode: "",
                  stateProvince: "",
                }))
              }
              placeholder="Search countries"
              emptyLabel={countriesQ.isPending ? "Loading…" : "No countries"}
            />
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">State / Province</p>
            <SearchableList<StateOption>
              items={statesQ.data?.states ?? []}
              getKey={(s) => s.stateCode || s.stateProvince}
              getLabel={(s) => s.stateProvince || s.stateCode || "—"}
              selectedKey={draft.stateCode || draft.stateProvince}
              onSelect={(s) => setDraft((d) => ({ ...d, stateCode: s?.stateCode ?? "", stateProvince: s?.stateProvince ?? "" }))}
              placeholder={draft.countryCode ? "Search states" : "Select a country first"}
              disabled={!draft.countryCode}
              emptyLabel={statesQ.isFetching ? "Loading…" : "No states"}
            />
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold text-slate-800 dark:text-zinc-100">Spot type</p>
            <div className="space-y-1.5">
              {LOCALE_SPOT_TYPES.map((spot) => (
                <label key={spot} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-zinc-200">
                  <input
                    type="checkbox"
                    checked={draft.spotTypes.includes(spot)}
                    onChange={() => toggleSpot(spot)}
                    className="h-4 w-4 rounded border-slate-300 accent-primary"
                  />
                  {spot}
                </label>
              ))}
            </div>
          </section>

          <section>
            <label htmlFor="locale-radius" className="mb-2 block text-sm font-semibold text-slate-800 dark:text-zinc-100">
              Search radius (km)
            </label>
            <input
              id="locale-radius"
              type="number"
              inputMode="decimal"
              min={1}
              value={draft.searchRadius}
              onChange={(e) => setDraft((d) => ({ ...d, searchRadius: e.target.value }))}
              placeholder="e.g. 50"
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
            {!hasLocation && draft.searchRadius.trim() ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Enable location to filter by distance.</p>
            ) : null}
          </section>
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4 dark:border-zinc-800">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={() => {
              setDraft(EMPTY_LOCALE_FILTERS);
              onApply(EMPTY_LOCALE_FILTERS);
            }}
          >
            Reset
          </Button>
          <Button className="flex-1 rounded-xl" onClick={() => onApply(draft)}>
            Search{count ? ` (${count})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}
