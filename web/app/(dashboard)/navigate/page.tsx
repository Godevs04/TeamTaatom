"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, Flag, Loader2, Navigation, Trash2, Video } from "lucide-react";
import {
  journeyGetActive,
  journeyStart,
  journeyPause,
  journeyResume,
  journeyComplete,
  journeyUpdateLocation,
  journeyDelete,
} from "@/lib/journey-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { JourneyCoord } from "@/types/journey";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useConfirm } from "@/context/confirm-context";
import { JourneyRouteMap } from "@/components/maps/journey-route-map";
import { LocaleNavigateMap } from "@/components/maps/locale-navigate-map";

export default function NavigatePage() {
  return (
    <React.Suspense fallback={null}>
      <NavigateContent />
    </React.Suspense>
  );
}

function parseCoord(raw: string | null): number | null {
  const n = raw == null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

function NavigateContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  // Destination handed over from a locale (mobile map/current-location.tsx flow).
  const destLat = parseCoord(searchParams.get("destLat"));
  const destLng = parseCoord(searchParams.get("destLng"));
  const destName = searchParams.get("destName") || "Destination";
  const destination = React.useMemo(
    () => (destLat != null && destLng != null ? { lat: destLat, lng: destLng, label: destName } : null),
    [destLat, destLng, destName]
  );
  /** Origin for the destination route — fixed once so live GPS ticks don't refetch routes. */
  const [routeOrigin, setRouteOrigin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [navigationOnly, setNavigationOnly] = React.useState(false);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const router = useRouter();
  const watchIdRef = React.useRef<number | null>(null);
  const bufferRef = React.useRef<JourneyCoord[]>([]);
  const journeyIdRef = React.useRef<string | null>(null);
  const flushTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const seededJourneyIdRef = React.useRef<string | null>(null);

  const [titleInput, setTitleInput] = React.useState("");
  const [livePoints, setLivePoints] = React.useState<JourneyCoord[]>([]);
  const [currentPosition, setCurrentPosition] = React.useState<{ lat: number; lng: number } | null>(null);

  const activeQ = useQuery({
    queryKey: ["journey-active"],
    queryFn: journeyGetActive,
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const journey = activeQ.data;
  const journeyId = journey?._id ?? null;
  const journeyStatusRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    journeyStatusRef.current = journey?.status;
  }, [journey?.status]);

  React.useEffect(() => {
    journeyIdRef.current = journeyId;
  }, [journeyId]);

  // Seed the locally-accumulated live route from the journey's persisted
  // polyline exactly once per journey id (e.g. on load, or resuming
  // tracking after a page refresh) -- not on every background refetch,
  // since that would lag behind and clobber points already accumulated
  // locally between flush intervals.
  React.useEffect(() => {
    if (!journeyId) {
      seededJourneyIdRef.current = null;
      setLivePoints([]);
      setCurrentPosition(null);
      return;
    }
    if (seededJourneyIdRef.current === journeyId) return;
    seededJourneyIdRef.current = journeyId;
    const seed = journey?.polyline ?? [];
    setLivePoints(seed);
    const last = seed[seed.length - 1];
    if (last) setCurrentPosition({ lat: last.lat, lng: last.lng });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId]);

  const stopTracking = React.useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (flushTimerRef.current) {
      clearInterval(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushBuffer = React.useCallback(async () => {
    const id = journeyIdRef.current;
    if (!id || bufferRef.current.length === 0) return;
    const batch = bufferRef.current.splice(0, bufferRef.current.length);
    try {
      await journeyUpdateLocation(id, batch);
    } catch {
      bufferRef.current.unshift(...batch);
    }
  }, []);

  const startTracking = React.useCallback(() => {
    if (!journeyIdRef.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    stopTracking();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (journeyStatusRef.current !== "active") return;
        const coord: JourneyCoord = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          accuracy: pos.coords.accuracy,
        };
        bufferRef.current.push(coord);
        setLivePoints((prev) => [...prev, coord]);
        setCurrentPosition({ lat: coord.lat, lng: coord.lng });
      },
      () => {
        toast.message("Location unavailable — check browser permissions.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    flushTimerRef.current = setInterval(() => {
      void flushBuffer();
    }, 12000);
  }, [flushBuffer, stopTracking]);

  React.useEffect(() => {
    if (journey?.status === "active") {
      startTracking();
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [journey?.status, journeyId, startTracking, stopTracking]);

  React.useEffect(() => {
    return () => {
      void flushBuffer();
    };
  }, [flushBuffer]);

  const onNavigateOnly = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRouteOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNavigationOnly(true);
      },
      () => toast.error("Allow location access to navigate."),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  const onStart = () => {
    if (!user) {
      toast.error("Sign in to start a journey.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    // Computed here (client-only, inside the handler) rather than at render
    // time -- toLocaleDateString()'s output can differ between the server's
    // and browser's locale/formatting, which caused a hydration mismatch
    // when this was hoisted into a render-time constant used as a prop.
    const title =
      titleInput.trim() || (destination ? `Trip to ${destination.label}` : `Trip ${new Date().toLocaleDateString()}`);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setRouteOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNavigationOnly(false);
        try {
          await journeyStart({
            startCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            title,
          });
          toast.success("Journey started.");
          setTitleInput("");
          await qc.invalidateQueries({ queryKey: ["journey-active"] });
        } catch (e) {
          toast.error(getFriendlyErrorMessage(e));
        }
      },
      () => toast.error("Allow location access to start."),
      { enableHighAccuracy: true, timeout: 20000 }
    );
  };

  const onPause = async () => {
    if (!journeyId) return;
    try {
      await flushBuffer();
      await journeyPause(journeyId);
      toast.success("Paused");
      await qc.invalidateQueries({ queryKey: ["journey-active"] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  const onResume = async () => {
    if (!journeyId) return;
    try {
      await journeyResume(journeyId);
      toast.success("Resumed");
      await qc.invalidateQueries({ queryKey: ["journey-active"] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  const onComplete = async () => {
    if (!journeyId) return;
    const ok = await confirm({
      title: "End Journey?",
      description: "Are you ready to end this journey and save your recorded route?",
      confirmText: "End & Save",
      cancelText: "Cancel",
      variant: "default",
    });
    if (!ok) return;
    try {
      await flushBuffer();
      await journeyComplete(journeyId);
      toast.success("Journey completed.");
      await qc.invalidateQueries({ queryKey: ["journey-active"] });
      await qc.invalidateQueries({ queryKey: ["journeys-user", user?._id] });
      router.push(`/journeys/${journeyId}`);
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  const onDiscard = async () => {
    if (!journeyId) return;
    const ok = await confirm({
      title: "Discard Journey?",
      description: `Discard "${journey?.title || "this journey"}"? This will not be saved.`,
      confirmText: "Discard",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      stopTracking();
      await journeyDelete(journeyId);
      toast.success("Journey discarded");
      await qc.invalidateQueries({ queryKey: ["journey-active"] });
      await qc.invalidateQueries({ queryKey: ["journeys-user", user?._id] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

  const showLiveMap = journey && (journey.status === "active" || journey.status === "paused");
  const destinationOrigin = routeOrigin ?? journey?.startCoords ?? currentPosition;

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-28 lg:pb-10">
      <Link href="/journeys" className="text-sm font-medium text-primary hover:underline">
        Past journeys
      </Link>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-premium dark:border-zinc-800 dark:bg-zinc-900/70">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15">
            <Navigation className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-slate-900 dark:text-white">Navigate</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Browser tracking works while this tab stays open (HTTPS). Background GPS is limited vs the mobile app.
            </p>
          </div>
        </div>

        {activeQ.isLoading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {!activeQ.isLoading && !journey && destination && (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-semibold text-slate-900 dark:text-white">Record Journey?</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-zinc-300">
              Heading to {destination.label}. Record your route as a journey, or just navigate.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={onNavigateOnly}>
                Navigation Only
              </Button>
              <Button onClick={onStart}>Record &amp; Navigate</Button>
            </div>
          </div>
        )}

        {destination && destinationOrigin && (navigationOnly || journey) ? (
          <div className="mt-6 space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Route to {destination.label}</p>
            <LocaleNavigateMap destination={destination} userPosition={destinationOrigin} className="h-72 w-full" />
          </div>
        ) : null}

        {!activeQ.isLoading && !journey && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-300">No active journey.</p>
            <input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Trip title (optional, defaults to today's date)"
              maxLength={100}
              className="w-full rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
            />
            <Button className="w-full" onClick={onStart}>
              Start journey
            </Button>
          </div>
        )}

        {journey && (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-zinc-800/80">
              <p className="font-semibold text-slate-900 dark:text-white">{journey.title}</p>
              <p className="text-xs text-slate-500">Status: {journey.status}</p>
              <p className="mt-2 text-xs text-slate-500">
                Points recorded: {journey.polyline?.length ?? 0}
              </p>
            </div>

            {showLiveMap && (
              <JourneyRouteMap
                polyline={livePoints}
                startCoords={journey.startCoords ?? null}
                currentPosition={currentPosition}
                live={journey.status === "active"}
                className="h-64 w-full"
              />
            )}

            {journey.status === "active" ? (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-2" asChild>
                  <Link href="/create?mode=post">
                    <Camera className="h-4 w-4" />
                    Photo
                  </Link>
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <Link href="/create?mode=short">
                    <Video className="h-4 w-4" />
                    Video
                  </Link>
                </Button>
                <p className="col-span-2 text-xs text-slate-500 dark:text-zinc-400">
                  Posts you share while this journey is active are added to it automatically.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              {journey.status === "active" && (
                <Button variant="outline" onClick={onPause}>
                  Pause
                </Button>
              )}
              {journey.status === "paused" && (
                <Button variant="outline" onClick={onResume}>
                  Resume
                </Button>
              )}
              <Button className={journey.status === "paused" ? "col-span-2 gap-2" : "gap-2"} onClick={onComplete}>
                <Flag className="h-4 w-4" />
                Finish journey
              </Button>
              <Button
                variant="outline"
                className="col-span-2 gap-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                onClick={onDiscard}
              >
                <Trash2 className="h-4 w-4" />
                Discard (don&apos;t save)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
