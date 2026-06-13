"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveProfileLocation } from "@/lib/api";
import { MapPin } from "lucide-react";

function formatGeocoded(parts: {
  city?: string | null;
  region?: string | null;
  country?: string | null;
}): string {
  return [parts.city, parts.region, parts.country].filter(Boolean).join(", ");
}

export default function OnboardingLocationPage() {
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onUseLocation = async () => {
    if (!navigator.geolocation) {
      setError("Location is not supported in this browser. You can continue without it.");
      return;
    }

    setSaving(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { Accept: "application/json" } },
          );
          const data = (await res.json()) as {
            address?: {
              city?: string;
              town?: string;
              village?: string;
              state?: string;
              country?: string;
            };
          };
          const addr = data.address;
          const city = addr?.city || addr?.town || addr?.village || addr?.state || "";
          const country = addr?.country || "";
          const label = formatGeocoded({ city, country });
          await saveProfileLocation({
            city: label || city || undefined,
            country: country || undefined,
          });
          router.replace("/onboarding/interests");
        } catch {
          toast.error("Could not save location. You can continue without it.");
          setError("Could not save your location. Try again or continue without it.");
        } finally {
          setSaving(false);
        }
      },
      () => {
        setSaving(false);
        setError("Location permission was denied. You can continue without sharing your location.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 },
    );
  };

  const onSkip = () => router.replace("/onboarding/interests");

  return (
    <div className="mx-auto max-w-lg rounded-[1.25rem] border border-slate-200/90 bg-white/95 p-8 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
      <p className="font-display text-xs font-semibold uppercase tracking-wide text-primary">Step 4 of 6</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">Share your location?</h1>
      <p className="mt-2 text-sm text-slate-600">
        Optional — helps us show nearby places and connect you with travelers in your area.
      </p>

      <div className="mt-8 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-9 w-9 text-primary" aria-hidden />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="rounded-xl font-semibold text-slate-600" onClick={onSkip} disabled={saving}>
          Not now
        </Button>
        <Button type="button" className="h-12 rounded-xl font-semibold sm:min-w-[180px]" disabled={saving} onClick={onUseLocation}>
          {saving ? "Getting location…" : "Use my current location"}
        </Button>
      </div>
    </div>
  );
}
