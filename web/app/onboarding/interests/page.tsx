"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveUserInterests } from "@/lib/api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";

const INTERESTS = [
  { id: "adventure", label: "Adventure" },
  { id: "beach", label: "Beach" },
  { id: "mountains", label: "Mountains" },
  { id: "city", label: "City life" },
  { id: "nature", label: "Nature" },
  { id: "culture", label: "Culture" },
  { id: "food", label: "Food" },
  { id: "nightlife", label: "Nightlife" },
  { id: "photography", label: "Photography" },
  { id: "wildlife", label: "Wildlife" },
  { id: "history", label: "History" },
  { id: "art", label: "Art & museums" },
];

export default function OnboardingInterestsPage() {
  const router = useRouter();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const next = async () => {
    setBusy(true);
    try {
      if (selected.length > 0) {
        await saveUserInterests(selected);
      }
      router.replace("/onboarding/suggested-users");
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
      router.replace("/onboarding/suggested-users");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/onboarding/welcome" className="text-sm font-medium text-primary hover:underline">
          ← Back
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold text-slate-900 dark:text-white">
          What interests you?
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">Pick a few — you can skip.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {INTERESTS.map((i) => {
          const on = selected.includes(i.id);
          return (
            <button
              key={i.id}
              type="button"
              onClick={() => toggle(i.id)}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              }`}
            >
              {i.label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button className="flex-1 rounded-xl" disabled={busy} onClick={() => void next()}>
          {busy ? "Saving…" : "Continue"}
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl" disabled={busy} onClick={() => router.replace("/onboarding/suggested-users")}>
          Skip
        </Button>
      </div>
    </div>
  );
}
