"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Navigation } from "lucide-react";
import {
  journeyGetActive,
  journeyStart,
  journeyPause,
  journeyResume,
  journeyComplete,
  journeyUpdateLocation,
} from "@/lib/journey-api";
import { getFriendlyErrorMessage } from "@/lib/auth-errors";
import type { JourneyCoord } from "@/types/journey";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

export default function NavigatePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const watchIdRef = React.useRef<number | null>(null);
  const bufferRef = React.useRef<JourneyCoord[]>([]);
  const journeyIdRef = React.useRef<string | null>(null);
  const flushTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

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
        bufferRef.current.push({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
          accuracy: pos.coords.accuracy,
        });
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

  const onStart = () => {
    if (!user) {
      toast.error("Sign in to start a journey.");
      return;
    }
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await journeyStart({
            startCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            title: `Trip ${new Date().toLocaleDateString()}`,
          });
          toast.success("Journey started.");
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
    if (!confirm("End this journey and save your route?")) return;
    try {
      await flushBuffer();
      await journeyComplete(journeyId);
      toast.success("Journey completed.");
      await qc.invalidateQueries({ queryKey: ["journey-active"] });
      await qc.invalidateQueries({ queryKey: ["journeys-user", user?._id] });
    } catch (e) {
      toast.error(getFriendlyErrorMessage(e));
    }
  };

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

        {!activeQ.isLoading && !journey && (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-300">No active journey.</p>
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
              <Button variant="destructive" className={journey.status === "paused" ? "col-span-2" : ""} onClick={onComplete}>
                Complete journey
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
