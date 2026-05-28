import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { registerResetCallback } from '../services/auth';

// True when running inside Expo Go. The native bits behind expo-task-manager
// + the iOS background-location capability aren't bundled there, so any
// startLocationUpdatesAsync call against our task throws. We bail out of
// background-tracking work on this branch — the foreground watcher still
// runs as before, just without bg coverage.
const isExpoGo = Constants.appOwnership === 'expo';

import {
  startJourney,
  pauseJourney,
  resumeJourney,
  completeJourney,
  updateJourneyLocation,
  getActiveJourney,
} from '../services/journey';
import { Journey, Coordinate } from '../types/journey';
import { calculateCoordinateDistance } from '../components/PolylineRenderer';

// Simple logger fallback (uses console if no logger util exists)
const logger = {
  debug: (...args: any[]) => __DEV__ && console.log(...args),
  error: (...args: any[]) => console.error(...args),
  warn: (...args: any[]) => console.warn(...args),
};

const BATCH_SEND_INTERVAL = 30000; // Send coordinates every 30 seconds
const MIN_LOCATION_DISTANCE = 5; // Minimum 5 meters between tracked points (denser paths)
// AsyncStorage prefix for the unsent-coords queue. Each in-memory push to
// batchCoordinatesRef also writes here so a crash mid-journey doesn't lose
// the path between the last successful 60s sync and the crash.
const PENDING_COORDS_KEY_PREFIX = 'pendingJourneyCoords:';
// AsyncStorage prefix for the *background-only* queue. When the app is
// suspended the foreground watchPositionAsync stops firing, but the
// TaskManager task below keeps writing locations here. On the next
// foreground transition we drain this into the polyline + send batch.
const BG_QUEUE_KEY_PREFIX = 'bgJourneyCoords:';
// TaskManager task name. Defined at module scope so it's registered on
// every JS bundle load (required by TaskManager's API contract — it must
// be reachable before `startLocationUpdatesAsync` is called).
const BG_LOCATION_TASK = 'taatom-journey-bg-location';

// Background location task. Runs in a headless JS context when the app is
// backgrounded / locked. Cannot touch React state — only persists incoming
// coordinates to AsyncStorage so the next foreground transition can replay
// them into the polyline.
//
// Wrapped in try/catch because the native ExpoTaskManager module isn't
// always linked — Expo Go skips it, and any custom dev client built before
// expo-task-manager was added to package.json won't have it either. When
// the native module is missing, defineTask throws "Cannot find native
// module 'ExpoTaskManager'" at module load and takes down every route
// that transitively imports this hook. `isExpoGo` only catches Expo Go,
// so we can't rely on it alone — the try/catch is the durable guard.
// The foreground watcher below still works without this — only background
// coverage is skipped when the native module is absent.
try {
  TaskManager.defineTask(BG_LOCATION_TASK, async (taskBody: any) => {
    const { data, error } = taskBody || {};
    if (error) return;
    if (!data) return;
    const locations = data?.locations as Location.LocationObject[] | undefined;
    if (!Array.isArray(locations) || locations.length === 0) return;

    try {
      const journeyId = await AsyncStorage.getItem('activeJourneyId');
      if (!journeyId) return; // Stale task firing after a stop — drop.

      const valid: Coordinate[] = [];
      for (const loc of locations) {
        const lat = loc?.coords?.latitude;
        const lng = loc?.coords?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
        const accuracy = loc.coords?.accuracy || 0;
        if (accuracy > 80) continue; // Filter out poor accuracy fixes in background (relaxed to 80m for low-power updates)
        valid.push({
          latitude: lat,
          longitude: lng,
          timestamp: loc.timestamp,
          accuracy,
        });
      }
      if (valid.length === 0) return;

      const queueKey = BG_QUEUE_KEY_PREFIX + journeyId;
      const existingRaw = await AsyncStorage.getItem(queueKey);
      let existing: Coordinate[] = [];
      if (existingRaw) {
        try {
          const parsed = JSON.parse(existingRaw);
          if (Array.isArray(parsed)) existing = parsed;
        } catch { /* keep existing empty */ }
      }
      await AsyncStorage.setItem(queueKey, JSON.stringify([...existing, ...valid]));
    } catch {
      // Background task must never throw — silent on error.
    }
  });
} catch (e) {
  // Native ExpoTaskManager module not linked in this build.
  // Background tracking is disabled; foreground watcher still works.
  if (__DEV__) {
    console.warn(
      '[Journey] expo-task-manager native module unavailable — background tracking disabled. ' +
      'Rebuild the dev client (eas build) to enable it.'
    );
  }
}

// Module-level pub/sub so every live instance of useJourneyTracking can stay
// in sync. The hook is currently called from multiple components
// (root _layout, navigate/index, navigate/tracking, navigate/detail, …) and
// each call has its own React state. Without this, ending a journey on the
// tracking screen left the root-layout's <JourneyStatusBar> stuck in
// "tracking" mode because the root instance never learned the journey ended.
type JourneyStateListener = () => void;
const journeyStateListeners: Set<JourneyStateListener> = new Set();
const broadcastJourneyStateChanged = () => {
  journeyStateListeners.forEach((listener) => {
    try { listener(); } catch (e) { /* ignore listener failures */ }
  });
};

interface UseJourneyTrackingReturn {
  initialized: boolean;
  isTracking: boolean;
  isPaused: boolean;
  journey: Journey | null;
  polyline: Coordinate[];
  distance: number;
  duration: number;
  accuracy: number | null;
  // Latest GPS reading, updated on every watcher emission regardless of
  // whether the point was significant enough to append to the polyline.
  // The marker UI should bind to this so it tracks the user even when
  // they're stationary or moving slowly.
  currentCoordinate: Coordinate | null;
  error: string | null;
  startJourneyRecording: (title?: string) => Promise<void>;
  pauseJourneyRecording: () => Promise<void>;
  resumeJourneyRecording: () => Promise<void>;
  stopJourneyRecording: (options?: { snapToRoads?: boolean }) => Promise<void>;
}

/**
 * useJourneyTracking
 *
 * Custom hook for managing journey GPS tracking lifecycle
 * - Handles foreground and background location tracking
 * - Batches GPS updates and sends to backend
 * - Manages journey pause/resume/complete
 * - Calculates running distance and duration
 * - Handles app state changes gracefully
 */
export function useJourneyTracking(): UseJourneyTrackingReturn {
  const [initialized, setInitialized] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [polyline, setPolyline] = useState<Coordinate[]>([]);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid stale closures
  // Flag to suppress syncFromSource when this instance just completed/started
  // a journey. Without this, broadcastJourneyStateChanged triggers the same
  // instance's sync listener which overwrites the journey state that was just
  // set (e.g. wiping the completed journey to null).
  const suppressNextSyncRef = useRef(false);
  const journeyIdRef = useRef<string | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const batchCoordinatesRef = useRef<Coordinate[]>([]);
  const lastCoordinateRef = useRef<Coordinate | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const batchSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  const startTimeRef = useRef<number | null>(null);
  // Tracks whether this hook instance is still mounted. Async paths (API
  // awaits, location callbacks fired after subscription removal on some
  // Android OEMs, late timer ticks) check this before calling setState so
  // we never get the "Can't perform a React state update on an unmounted
  // component" warning that surfaces in Sentry as JS errors on RN 0.81+.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Note: Background task registration removed (expo-task-manager not installed)
  // Foreground tracking via watchPositionAsync is used instead

  // Persist the in-memory pending-batch to AsyncStorage so an app crash mid
  // -journey doesn't lose the path between the last 60s sync and the crash.
  // Fire-and-forget — the watcher fires every 2s and we don't want to block
  // it on disk I/O. AsyncStorage serializes writes internally so the latest
  // call wins.
  const persistPendingCoords = useCallback(() => {
    const id = journeyIdRef.current;
    if (!id) return;
    AsyncStorage.setItem(
      PENDING_COORDS_KEY_PREFIX + id,
      JSON.stringify(batchCoordinatesRef.current)
    ).catch(() => {});
  }, []);

  const clearPersistedCoords = useCallback((journeyId: string | null) => {
    if (!journeyId) return;
    AsyncStorage.removeItem(PENDING_COORDS_KEY_PREFIX + journeyId).catch(() => {});
  }, []);

  // Single source of truth for spinning up the foreground location watcher.
  // Called from startJourneyRecording, resumeJourneyRecording, AND
  // initializeJourney (on screens that mount mid-journey, like tracking.tsx).
  // distanceInterval is 0 so emissions are purely time-based — that way the
  // marker and accuracy chip update even when the user is stationary; we
  // still gate polyline appends on MIN_LOCATION_DISTANCE to keep the path clean.
  const startLocationWatcher = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (locationWatcherRef.current) return; // already running on this instance
    locationWatcherRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 1000,
      },
      (location) => {
        // Some Android OEMs deliver one more emission after the
        // subscription has been removed. Guard against a setState on an
        // unmounted instance.
        if (!isMountedRef.current) return;
        // Defensive: invalid coords from the OS would propagate NaN into
        // the polyline and crash distance math / map renderers.
        const lat = location?.coords?.latitude;
        const lng = location?.coords?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) return;
        const coord: Coordinate = {
          latitude: lat,
          longitude: lng,
          timestamp: location.timestamp,
          accuracy: location.coords.accuracy || 0,
        };
        setAccuracy(coord.accuracy);
        setCurrentCoordinate(coord);

        // Ignore updates with poor GPS accuracy (> 30 meters) to avoid erratic spikes/drift
        if (coord.accuracy && coord.accuracy > 30) {
          logger.debug(`[Journey] Discarding low-accuracy coordinate (±${coord.accuracy}m) for polyline tracking.`);
          return;
        }

        // Only grow the polyline / running distance when movement is
        // significant. First emission seeds lastCoordinateRef.
        if (lastCoordinateRef.current) {
          const dist = calculateCoordinateDistance(
            lastCoordinateRef.current.latitude,
            lastCoordinateRef.current.longitude,
            coord.latitude,
            coord.longitude
          );
          if (dist >= MIN_LOCATION_DISTANCE) {
            lastCoordinateRef.current = coord;
            setPolyline((prev) => [...prev, coord]);
            setDistance((prev) => prev + dist);
            batchCoordinatesRef.current.push(coord);
            persistPendingCoords();
          }
        } else {
          lastCoordinateRef.current = coord;
        }
      }
    );
  }, [persistPendingCoords]);

  // Cleanup the foreground watcher on unmount so the leaked native subscription
  // doesn't keep firing into a dead component (and burning battery) after a
  // screen that mounted this hook is replaced.
  useEffect(() => {
    return () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (batchSendTimerRef.current) clearInterval(batchSendTimerRef.current);
    };
  }, []);

  // Initialize journey from storage if exists
  useEffect(() => {
    const initializeJourney = async () => {
      try {
        // Check if there's an active journey in storage
        const storedJourneyId = await AsyncStorage.getItem('activeJourneyId');
        if (storedJourneyId) {
          journeyIdRef.current = storedJourneyId;
          setIsTracking(true);

          // Rehydrate active journey state from AsyncStorage immediately to survive app kill
          try {
            const cachedStateRaw = await AsyncStorage.getItem('@active_journey_state');
            if (cachedStateRaw) {
              const cached = JSON.parse(cachedStateRaw);
              if (cached && cached.journey && cached.journey._id === storedJourneyId) {
                setJourney(cached.journey);
                const normalizedPolyline: Coordinate[] = (cached.polyline || []).map((p: any) => ({
                  latitude: p.latitude ?? p.lat,
                  longitude: p.longitude ?? p.lng,
                  timestamp: typeof p.timestamp === 'string' ? new Date(p.timestamp).getTime() : (p.timestamp || 0),
                  accuracy: p.accuracy ?? 0,
                }));
                setPolyline(normalizedPolyline);
                setDistance(cached.distance || 0);
                setDuration(cached.duration || 0);
                setIsPaused(cached.journey.status === 'paused');
                if (normalizedPolyline.length > 0) {
                  lastCoordinateRef.current = normalizedPolyline[normalizedPolyline.length - 1];
                }
                if (cached.journey.status !== 'paused' && cached.timestamp) {
                  const startedAtMs = new Date(cached.journey.startedAt).getTime();
                  startTimeRef.current = startedAtMs;
                  const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
                  setDuration(Math.max(0, elapsed));
                }
                logger.debug('[Journey] Rehydrated state from AsyncStorage:', cached.journey._id);
              }
            }
          } catch (cacheErr) {
            logger.warn('[Journey] Failed to rehydrate from AsyncStorage:', cacheErr);
          }

          // Fetch journey details from backend
          try {
            const { journey: fetchedJourney } = await getActiveJourney();
            if (fetchedJourney) {
              setJourney(fetchedJourney);
              // Backend polyline uses {lat, lng} but the frontend
              // Coordinate type (and calculateCoordinateDistance) expects
              // {latitude, longitude}. Normalize on restore so the
              // watcher's distance calculation doesn't receive undefined.
              const normalizedPolyline: Coordinate[] = (fetchedJourney.polyline || []).map((p: any) => ({
                latitude: p.latitude ?? p.lat,
                longitude: p.longitude ?? p.lng,
                timestamp: typeof p.timestamp === 'string' ? new Date(p.timestamp).getTime() : (p.timestamp || 0),
                accuracy: p.accuracy ?? 0,
              }));
              setPolyline(normalizedPolyline);
              setDistance(fetchedJourney.distanceTraveled || 0);
              // Set startTimeRef so the duration useEffect can spin up its
              // 1s ticker. Before this fix, the ref stayed null on screens
              // that mounted mid-journey (e.g. tracking.tsx after a
              // router.replace) so the duration never advanced live.
              if (fetchedJourney.startedAt) {
                const startedAtMs = new Date(fetchedJourney.startedAt).getTime();
                startTimeRef.current = startedAtMs;
                const elapsed = Math.floor((Date.now() - startedAtMs) / 1000);
                setDuration(Math.max(0, elapsed));
              }
              const isPausedJourney = fetchedJourney.status === 'paused';
              setIsPaused(isPausedJourney);

              // Seed lastCoordinateRef from the tail of the restored polyline
              // so further emissions compute deltas against the right base.
              if (normalizedPolyline.length > 0) {
                lastCoordinateRef.current = normalizedPolyline[normalizedPolyline.length - 1];
              }

              // Recover any points that were pushed but not yet sent (e.g.
              // app was force-quit between two 60s syncs). Replay them into
              // the in-memory polyline / batch so they ride out on the next
              // batch send or the final flush at journey end. Validate each
              // entry — a corrupted blob (write interrupted by force-quit)
              // would otherwise propagate NaNs into the polyline and crash
              // calculateCoordinateDistance / map renderers downstream.
              try {
                const persistedKey = PENDING_COORDS_KEY_PREFIX + storedJourneyId;
                const persistedRaw = await AsyncStorage.getItem(persistedKey);
                if (persistedRaw) {
                  const persisted = JSON.parse(persistedRaw);
                  const valid: Coordinate[] = Array.isArray(persisted)
                    ? persisted.filter((c: any) =>
                        c &&
                        typeof c === 'object' &&
                        typeof c.latitude === 'number' &&
                        typeof c.longitude === 'number' &&
                        !isNaN(c.latitude) && !isNaN(c.longitude) &&
                        c.latitude >= -90 && c.latitude <= 90 &&
                        c.longitude >= -180 && c.longitude <= 180
                      )
                    : [];
                  if (valid.length > 0) {
                    batchCoordinatesRef.current = [...valid];
                    setPolyline((prev) => [...prev, ...valid]);
                    lastCoordinateRef.current = valid[valid.length - 1];
                    logger.debug(`[Journey] Recovered ${valid.length} unsent coords from storage` +
                      (Array.isArray(persisted) && persisted.length !== valid.length
                        ? ` (${persisted.length - valid.length} dropped as malformed)`
                        : ''));
                  } else if (Array.isArray(persisted) && persisted.length > 0) {
                    // Entire blob was malformed — clear it so we don't keep
                    // re-loading the same corrupt data on every mount.
                    AsyncStorage.removeItem(persistedKey).catch(() => {});
                  }
                }
              } catch (e) {
                logger.warn('[Journey] Failed to recover unsent coords:', e);
              }

              // CRITICAL: restart the foreground watcher on this fresh
              // hook instance. Without this, screens mounted mid-journey
              // (router.replace from index → tracking) had no live GPS
              // pipe — the polyline never grew and the marker stayed at
              // the start point.
              if (!isPausedJourney) {
                try { await startLocationWatcher(); } catch (e) {
                  logger.warn('[Journey] Failed to start watcher on restore:', e);
                }
              }
              logger.debug('[Journey] Restored active journey from backend:', fetchedJourney._id);
            }
          } catch (err) {
            logger.error('[Journey] Failed to fetch active journey:', err);
          }
        }
      } catch (err) {
        logger.error('[Journey] Failed to initialize journey:', err);
      } finally {
        setInitialized(true);
      }
    };

    // Re-sync this instance against the storage / backend source of truth.
    // Called on mount AND on every cross-instance broadcast (e.g. when the
    // tracking screen ends the journey, the root-layout instance hears the
    // broadcast, sees activeJourneyId is gone, and clears its own state so
    // the JourneyStatusBar disappears).
    const syncFromSource = async () => {
      // When this instance just called start/stop/pause/resume, skip the
      // self-triggered sync to avoid overwriting the state that was just set
      // (e.g. wiping the completed journey to null).
      if (suppressNextSyncRef.current) {
        suppressNextSyncRef.current = false;
        return;
      }
      try {
        const storedJourneyId = await AsyncStorage.getItem('activeJourneyId');
        // Component may have unmounted while we awaited the storage read
        // (rapid navigation). Bail before any setState fires on a dead
        // instance.
        if (!isMountedRef.current) return;
        if (!storedJourneyId) {
          // Journey ended elsewhere — wipe local live state.
          if (locationWatcherRef.current) {
            locationWatcherRef.current.remove();
            locationWatcherRef.current = null;
          }
          if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
          }
          if (batchSendTimerRef.current) {
            clearInterval(batchSendTimerRef.current);
            batchSendTimerRef.current = null;
          }
          // Clear our local copy of the persisted batch (if any) — the
          // initiating instance is responsible for removing the AsyncStorage
          // entry, but this instance's in-memory ref may still be holding
          // points pushed before the broadcast arrived.
          journeyIdRef.current = null;
          startTimeRef.current = null;
          lastCoordinateRef.current = null;
          batchCoordinatesRef.current = [];
          setIsTracking(false);
          setIsPaused(false);
          setJourney(null);
          setPolyline([]);
          setDistance(0);
          setDuration(0);
          setAccuracy(null);
          setCurrentCoordinate(null);
          return;
        }
        // Active journey still exists — re-run init flow to pick up
        // status changes (e.g. pause/resume from another instance).
        await initializeJourney();
      } catch (err) {
        logger.error('[Journey] syncFromSource failed:', err);
      }
    };

    initializeJourney();

    // One-shot sweep of stale bg-queue entries. If the user ended a
    // journey while the app was force-quit and the activeJourneyId was
    // cleared, but the bg task captured a few coords on the next OS-
    // delivered emission before stopLocationUpdatesAsync took effect, the
    // queue entry would linger forever. Drop any bg-queue keys that don't
    // match the current activeJourneyId. Cheap (one AsyncStorage scan)
    // and runs once per mount.
    (async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const bgKeys = allKeys.filter(k => k.startsWith(BG_QUEUE_KEY_PREFIX));
        if (bgKeys.length === 0) return;
        const activeId = await AsyncStorage.getItem('activeJourneyId');
        const stale = bgKeys.filter(k => k.slice(BG_QUEUE_KEY_PREFIX.length) !== activeId);
        if (stale.length > 0) {
          await AsyncStorage.multiRemove(stale).catch(() => {});
          logger.debug(`[Journey] Swept ${stale.length} stale bg-queue entries`);
        }
      } catch {
        // Silent — sweep is best-effort cleanup, not critical.
      }
    })();

    // Subscribe to cross-instance broadcasts so this hook's state stays in
    // sync with whatever screen actually called start/pause/resume/stop.
    journeyStateListeners.add(syncFromSource);
    return () => {
      journeyStateListeners.delete(syncFromSource);
    };
  }, []);

  // Duration timer - updates every second
  useEffect(() => {
    if (isTracking && !isPaused && startTimeRef.current) {
      durationTimerRef.current = setInterval(() => {
        if (!isMountedRef.current || !startTimeRef.current) return;
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);
      }, 1000);

      return () => {
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
        }
      };
    }
  }, [isTracking, isPaused]);

  // Batch send coordinates every BATCH_SEND_INTERVAL ms.
  // Previously this effect's outer guard included
  // `batchCoordinatesRef.current.length > 0`, but at the moment isTracking
  // flips to true the batch is empty, so the setInterval was never created
  // and incremental syncs never fired. Now we always start the timer when
  // tracking becomes active and let the interval body decide whether to POST.
  useEffect(() => {
    if (!isTracking || isPaused) return;
    batchSendTimerRef.current = setInterval(async () => {
      if (!isMountedRef.current) return;
      const id = journeyIdRef.current;
      if (!id) return;
      if (batchCoordinatesRef.current.length === 0) return;
      // Take ownership of the current batch atomically; on failure we
      // re-prepend so they ride out on the next attempt.
      const coords = batchCoordinatesRef.current.splice(0);
      try {
        await updateJourneyLocation(id, coords);
        logger.debug(`[Journey] Sent ${coords.length} coordinates to backend`);
        // Persisted-batch matches the (now empty) in-memory batch.
        clearPersistedCoords(id);
      } catch (err) {
        logger.error('[Journey] Failed to update location, requeuing:', err);
        batchCoordinatesRef.current.unshift(...coords);
        // Re-persist so a subsequent crash still keeps the queued points.
        persistPendingCoords();
      }
    }, BATCH_SEND_INTERVAL);

    return () => {
      if (batchSendTimerRef.current) {
        clearInterval(batchSendTimerRef.current);
        batchSendTimerRef.current = null;
      }
    };
  }, [isTracking, isPaused, persistPendingCoords, clearPersistedCoords]);

  // Track the latest polyline timestamps in a ref so the AppState handler
  // can dedupe coords drained from the background queue without subscribing
  // to polyline changes (which would re-create the AppState listener on
  // every emission).
  const polylineRef = useRef<Coordinate[]>([]);
  useEffect(() => {
    polylineRef.current = polyline;
  }, [polyline]);

  // Helper: start background location updates via TaskManager. Idempotent —
  // safe to call when already running. Returns true on success / already-
  // running so the caller can decide whether to keep the foreground watcher
  // running as a fallback.
  const startBackgroundUpdates = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    if (isExpoGo) {
      logger.debug('[Journey] Skipping background updates in Expo Go (native module unavailable)');
      return false;
    }
    try {
      const already = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
      if (already) return true;
      await Location.startLocationUpdatesAsync(BG_LOCATION_TASK, {
        accuracy: Location.Accuracy.High, // Upgraded for high-accuracy path tracking
        timeInterval: 5000, // Query every 5 seconds for a denser track
        distanceInterval: 5, // Track every 5 meters
        showsBackgroundLocationIndicator: true, // Enable indicator to prevent OS suspension
        foregroundService: {
          notificationTitle: 'Recording your journey',
          notificationBody: 'Path is being tracked while the app is in the background',
          notificationColor: '#22C55E',
        },
        pausesUpdatesAutomatically: false,
      });
      logger.debug('[Journey] Background location updates started');
      return true;
    } catch (e) {
      logger.warn('[Journey] Failed to start background updates (non-blocking):', e);
      return false;
    }
  }, []);

  const stopBackgroundUpdates = useCallback(async () => {
    if (Platform.OS === 'web') return;
    if (isExpoGo) return;
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(BG_LOCATION_TASK).catch(() => false);
      if (running) {
        await Location.stopLocationUpdatesAsync(BG_LOCATION_TASK);
        logger.debug('[Journey] Background location updates stopped');
      }
    } catch (e) {
      logger.warn('[Journey] Failed to stop background updates:', e);
    }
  }, []);

  // Drain coords accumulated by the background task while the app was
  // suspended. Called on app-foreground and on hook init for recovery.
  const drainBackgroundQueue = useCallback(async () => {
    const id = journeyIdRef.current;
    if (!id) return;
    const queueKey = BG_QUEUE_KEY_PREFIX + id;
    try {
      const raw = await AsyncStorage.getItem(queueKey);
      if (!raw) return;
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        await AsyncStorage.removeItem(queueKey).catch(() => {});
        return;
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        await AsyncStorage.removeItem(queueKey).catch(() => {});
        return;
      }

      // Validate + dedupe against current polyline by timestamp.
      // Use a 500ms tolerance window because the OS occasionally replays a
      // sample on the fg→bg handoff edge with a slightly different
      // timestamp; an exact-match Set would let it through and double-
      // count a single physical fix. Sorted-by-timestamp existing list
      // lets the lookup short-circuit.
      const TS_TOLERANCE_MS = 500;
      const existingSorted = polylineRef.current
        .map(c => c.timestamp)
        .filter((t): t is number => typeof t === 'number')
        .sort((a, b) => a - b);
      const isDuplicateTimestamp = (ts: number): boolean => {
        if (typeof ts !== 'number') return false;
        // Linear scan is fine — polyline is small (<~few thousand even on
        // a multi-day journey) and we only call this on bg-queue drain.
        for (const e of existingSorted) {
          if (Math.abs(e - ts) <= TS_TOLERANCE_MS) return true;
          if (e > ts + TS_TOLERANCE_MS) break;
        }
        return false;
      };
      const valid: Coordinate[] = parsed.filter((c: any) =>
        c &&
        typeof c === 'object' &&
        typeof c.latitude === 'number' &&
        typeof c.longitude === 'number' &&
        !Number.isNaN(c.latitude) && !Number.isNaN(c.longitude) &&
        c.latitude >= -90 && c.latitude <= 90 &&
        c.longitude >= -180 && c.longitude <= 180 &&
        !isDuplicateTimestamp(c.timestamp)
      );

      // Apply the same MIN_LOCATION_DISTANCE filter the foreground watcher
      // uses, walking from the last known polyline tail forward, so a row
      // of background coords doesn't introduce a denser-than-foreground
      // segment of the path.
      let lastCoord = lastCoordinateRef.current;
      const accepted: Coordinate[] = [];
      let addedDistance = 0;
      for (const c of valid) {
        if (!lastCoord) {
          accepted.push(c);
          lastCoord = c;
          continue;
        }
        const d = calculateCoordinateDistance(
          lastCoord.latitude, lastCoord.longitude,
          c.latitude, c.longitude
        );
        if (d >= MIN_LOCATION_DISTANCE) {
          accepted.push(c);
          addedDistance += d;
          lastCoord = c;
        }
      }

      if (accepted.length > 0) {
        lastCoordinateRef.current = accepted[accepted.length - 1];
        setPolyline(prev => [...prev, ...accepted]);
        setDistance(prev => prev + addedDistance);
        // Push into the send batch so the next 60s sync ships them.
        batchCoordinatesRef.current.push(...accepted);
        persistPendingCoords();
        // Update accuracy display to the latest sample.
        const latest = accepted[accepted.length - 1];
        setAccuracy(latest.accuracy ?? null);
        setCurrentCoordinate(latest);
        logger.debug(`[Journey] Drained ${accepted.length} background coords (+${Math.round(addedDistance)}m)`);
      }

      await AsyncStorage.removeItem(queueKey).catch(() => {});
    } catch (e) {
      logger.warn('[Journey] drainBackgroundQueue failed:', e);
    }
  }, [persistPendingCoords]);

  // Hold the latest isTracking/isPaused in refs so handleAppStateChange's
  // identity stays stable across pause/resume. Without this, the AppState
  // listener was being torn down and re-added on every state flip — if
  // AppState happened to fire in that window the event vanished.
  const isTrackingRef = useRef(isTracking);
  const isPausedRef = useRef(isPaused);
  useEffect(() => { isTrackingRef.current = isTracking; }, [isTracking]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);

  const handleAppStateChange = useCallback(
    async (nextAppState: any) => {
      const currentAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App went to background
      if (currentAppState.match(/active/) && nextAppState === 'background') {
        if (isTrackingRef.current && !isPausedRef.current) {
          logger.debug('[Journey] App backgrounded — handing off to TaskManager');
          // Start the background task FIRST. If it succeeds, only then tear
          // down the foreground watcher. If the bg start fails (Expo Go,
          // permission denied, OS suspended us mid-flight), keep the
          // foreground watcher running — it'll continue firing for a few
          // seconds in background on most devices, which is better than
          // having no source at all during the handoff window.
          const bgStarted = await startBackgroundUpdates();
          if (bgStarted && locationWatcherRef.current) {
            try { locationWatcherRef.current.remove(); } catch { /* noop */ }
            locationWatcherRef.current = null;
          }
        }
      }

      // App came to foreground
      if (nextAppState === 'active' && currentAppState.match(/inactive|background/)) {
        if (isTrackingRef.current && !isPausedRef.current) {
          logger.debug('[Journey] App foregrounded — draining bg queue, restarting watcher');
          await stopBackgroundUpdates();
          await drainBackgroundQueue();
          // Restart the foreground watcher so live UI updates resume.
          try { await startLocationWatcher(); } catch (e) {
            logger.warn('[Journey] Failed to restart foreground watcher:', e);
          }
        }
      }
    },
    // Deps are intentionally only the (stable) helper callbacks. State
    // values are read through refs above so the handler identity stays
    // stable across pause/resume — no listener tear-down/rebind churn.
    [startBackgroundUpdates, stopBackgroundUpdates, drainBackgroundQueue, startLocationWatcher]
  );

  // Listen to app state changes. handleAppStateChange identity is now
  // stable across pause/resume, so this useEffect runs once per mount.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [handleAppStateChange]);

  const startJourneyRecording = useCallback(
    async (title?: string) => {
      try {
        setError(null);

        // Request foreground location permission (always required first).
        const foregroundPermission = await Location.requestForegroundPermissionsAsync();
        if (!foregroundPermission.granted) {
          const err = 'Location permission denied';
          setError(err);
          throw new Error(err);
        }

        // Request background ("Always") permission so the path keeps
        // recording when the phone is locked or the app is backgrounded.
        // Treat denial as a soft failure — the journey still works in the
        // foreground; the user just won't get the full path if they leave
        // the app. iOS surfaces this as a separate "Allow Always" prompt
        // shortly after the first foreground prompt.
        if (Platform.OS !== 'web') {
          try {
            await Location.requestBackgroundPermissionsAsync();
          } catch (e) {
            logger.warn('[Journey] Background permission request failed (non-blocking):', e);
          }
        }

        // Get current location
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const startCoords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };

        // Call API to start journey
        const { journey: newJourney } = await startJourney(startCoords, title);
        journeyIdRef.current = newJourney._id;
        startTimeRef.current = Date.now();

        // Save to local storage
        await AsyncStorage.setItem('activeJourneyId', newJourney._id);
        // Wipe any stale persisted batch from a prior journey on this device.
        clearPersistedCoords(newJourney._id);

        // Initialize polyline with start location
        const initialCoord: Coordinate = {
          latitude: startCoords.lat,
          longitude: startCoords.lng,
          timestamp: Date.now(),
          accuracy: location.coords.accuracy || 0,
        };
        lastCoordinateRef.current = initialCoord;
        setPolyline([initialCoord]);
        setAccuracy(location.coords.accuracy);
        setCurrentCoordinate(initialCoord);
        batchCoordinatesRef.current = [];

        // Set state
        setJourney(newJourney);
        setIsTracking(true);
        setIsPaused(false);
        setDistance(0);
        setDuration(0);

        // Start foreground location watching via the centralized helper so
        // every entry path uses the same watcher settings AND persists the
        // batch on each push.
        await startLocationWatcher();

        logger.debug('[Journey] Started journey recording:', newJourney._id);
        suppressNextSyncRef.current = true;
        broadcastJourneyStateChanged();
      } catch (err: any) {
        const errorMsg = err?.message || 'Failed to start journey';
        setError(errorMsg);
        logger.error('[Journey] startJourneyRecording failed:', err);
        throw err;
      }
    },
    []
  );

  const pauseJourneyRecording = useCallback(async () => {
    try {
      setError(null);

      if (!journeyIdRef.current) {
        throw new Error('No active journey');
      }

      // Stop foreground watcher
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      lastCoordinateRef.current = null; // Clear so the next resume starts a fresh distance segment

      // Stop the background TaskManager updates if they're running and
      // drain anything it managed to capture before pause was hit.
      await stopBackgroundUpdates();
      await drainBackgroundQueue();

      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (batchSendTimerRef.current) {
        clearInterval(batchSendTimerRef.current);
      }

      // Send any remaining coordinates BEFORE pausing (backend rejects updates on paused journeys)
      if (batchCoordinatesRef.current.length > 0) {
        const coords = batchCoordinatesRef.current.splice(0);
        try {
          await updateJourneyLocation(journeyIdRef.current, coords);
          clearPersistedCoords(journeyIdRef.current);
        } catch (err) {
          logger.error('[Journey] Failed to send final coordinates:', err);
          // Re-queue + re-persist so resume / next foreground session can flush.
          batchCoordinatesRef.current.unshift(...coords);
          persistPendingCoords();
        }
      }

      // Call API to pause
      const { journey: pausedJourney } = await pauseJourney(journeyIdRef.current);
      setJourney(pausedJourney);
      setIsPaused(true);

      logger.debug('[Journey] Paused journey:', journeyIdRef.current);
      suppressNextSyncRef.current = true;
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to pause journey';
      setError(errorMsg);
      logger.error('[Journey] pauseJourneyRecording failed:', err);
      throw err;
    }
  }, [stopBackgroundUpdates, drainBackgroundQueue, persistPendingCoords, clearPersistedCoords]);

  const resumeJourneyRecording = useCallback(async () => {
    try {
      setError(null);

      if (!journeyIdRef.current) {
        throw new Error('No paused journey');
      }

      // Request permissions again
      const foregroundPermission = await Location.requestForegroundPermissionsAsync();
      if (!foregroundPermission.granted) {
        const err = 'Location permission denied';
        setError(err);
        throw new Error(err);
      }

      // Call API
      const { journey: resumedJourney } = await resumeJourney(journeyIdRef.current);
      setJourney(resumedJourney);
      setIsPaused(false);

      // Reset duration timer
      startTimeRef.current = Date.now() - resumedJourney.duration * 1000;
      lastCoordinateRef.current = null; // Clear to guarantee first location fix starts a new segment

      // Restart location watcher via the centralized helper.
      await startLocationWatcher();

      logger.debug('[Journey] Resumed journey:', journeyIdRef.current);
      suppressNextSyncRef.current = true;
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to resume journey';
      setError(errorMsg);
      logger.error('[Journey] resumeJourneyRecording failed:', err);
      throw err;
    }
  }, []);

  const stopJourneyRecording = useCallback(async (options?: { snapToRoads?: boolean }) => {
    try {
      setError(null);

      if (!journeyIdRef.current) {
        throw new Error('No active journey');
      }

      // Capture one final high-accuracy coordinate to guarantee the exact ending location pin is precise
      try {
        const finalLoc = await Promise.race([
          Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          }),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)) // 4s timeout fallback
        ]);

        if (finalLoc) {
          const finalCoord: Coordinate = {
            latitude: finalLoc.coords.latitude,
            longitude: finalLoc.coords.longitude,
            timestamp: finalLoc.timestamp,
            accuracy: finalLoc.coords.accuracy || 0,
          };

          if (!finalCoord.accuracy || finalCoord.accuracy <= 30) {
            // Avoid duplicate points if final location is virtually identical to the last tracked point
            const lastTracked = lastCoordinateRef.current;
            const dist = lastTracked
              ? calculateCoordinateDistance(
                  lastTracked.latitude,
                  lastTracked.longitude,
                  finalCoord.latitude,
                  finalCoord.longitude
                )
              : Infinity;

            if (dist >= 1) { // only push if at least 1 meter away or if no prior point
              batchCoordinatesRef.current.push(finalCoord);
              setPolyline((prev) => [...prev, finalCoord]);
              lastCoordinateRef.current = finalCoord;
            }
          }
        }
      } catch (locErr) {
        logger.warn('[Journey] Could not fetch final high-accuracy location for stop:', locErr);
      }

      // Stop location tracking
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      lastCoordinateRef.current = null; // Clear on stop

      // Stop background updates and absorb anything the bg task captured
      // since the last drain so the final batch includes them.
      await stopBackgroundUpdates();
      await drainBackgroundQueue();

      // Stop timers
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      if (batchSendTimerRef.current) {
        clearInterval(batchSendTimerRef.current);
      }

      // Send final coordinates. If the network is bad at exactly this
      // moment we don't lose them — the persisted-batch entry stays on disk
      // and the next time the user opens the app with this journey id, the
      // init flow recovers them.
      const completingJourneyId = journeyIdRef.current;
      if (batchCoordinatesRef.current.length > 0) {
        const coords = batchCoordinatesRef.current.splice(0);
        try {
          await updateJourneyLocation(completingJourneyId, coords);
          clearPersistedCoords(completingJourneyId);
        } catch (err) {
          logger.error('[Journey] Failed to send final coordinates:', err);
          batchCoordinatesRef.current.unshift(...coords);
          persistPendingCoords();
          // Don't proceed to completeJourney — surface the error so the
          // user can retry from the End Journey button.
          throw err;
        }
      } else {
        // Even if the in-memory batch is empty the persisted-batch entry
        // could still be present from a prior failed send. Clear it.
        clearPersistedCoords(completingJourneyId);
      }
      // Final clean-up of the bg-only queue (drainBackgroundQueue removed
      // it on success above, but if drain failed silently the key could
      // linger and feed into a *future* journey with the same id — which
      // shouldn't happen, but the guard is cheap).
      await AsyncStorage.removeItem(BG_QUEUE_KEY_PREFIX + completingJourneyId).catch(() => {});

      // Call API with snapToRoads option
      const snapToRoads = options?.snapToRoads !== false;
      const { journey: completedJourney } = await completeJourney(completingJourneyId, { snapToRoads });
      setJourney(completedJourney);
      setIsTracking(false);
      setIsPaused(false);

      // Clear from storage
      await AsyncStorage.removeItem('activeJourneyId');

      logger.debug('[Journey] Completed journey:', completingJourneyId);
      journeyIdRef.current = null;
      startTimeRef.current = null;
      lastCoordinateRef.current = null;
      batchCoordinatesRef.current = [];
      // Notify other live instances of useJourneyTracking (root layout's
      // JourneyStatusBar etc.) so they wipe their own copies of the journey
      // state. Without this the recording popup persisted because the root
      // instance's isTracking was never updated.
      suppressNextSyncRef.current = true;
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to stop journey';
      setError(errorMsg);
      logger.error('[Journey] stopJourneyRecording failed:', err);
      throw err;
    }
  }, [stopBackgroundUpdates, drainBackgroundQueue, persistPendingCoords, clearPersistedCoords]);

  // Save active journey state to AsyncStorage whenever it updates to survive app force-closes
  useEffect(() => {
    const id = journeyIdRef.current;
    if (initialized && isTracking && id && journey) {
      const stateToSave = {
        journey,
        polyline,
        distance,
        duration,
        timestamp: Date.now(),
      };
      AsyncStorage.setItem('@active_journey_state', JSON.stringify(stateToSave)).catch(() => {});
    } else if (initialized && !isTracking) {
      AsyncStorage.removeItem('@active_journey_state').catch(() => {});
    }
  }, [isTracking, isPaused, journey, polyline, distance, duration, initialized]);

  const resetTrackingState = useCallback(async () => {
    try {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      if (batchSendTimerRef.current) {
        clearInterval(batchSendTimerRef.current);
        batchSendTimerRef.current = null;
      }
      await stopBackgroundUpdates();
      journeyIdRef.current = null;
      startTimeRef.current = null;
      lastCoordinateRef.current = null;
      batchCoordinatesRef.current = [];
      setIsTracking(false);
      setIsPaused(false);
      setJourney(null);
      setPolyline([]);
      setDistance(0);
      setDuration(0);
      setAccuracy(null);
      setCurrentCoordinate(null);
      setError(null);
      logger.debug('[Journey] Reset tracking state complete');
    } catch (e) {
      logger.error('[Journey] Failed to reset tracking state:', e);
    }
  }, [stopBackgroundUpdates]);

  useEffect(() => {
    const unregister = registerResetCallback(() => {
      resetTrackingState();
    });
    return () => unregister();
  }, [resetTrackingState]);

  return {
    initialized,
    isTracking,
    isPaused,
    journey,
    polyline,
    distance,
    duration,
    accuracy,
    currentCoordinate,
    error,
    startJourneyRecording,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  };
}
