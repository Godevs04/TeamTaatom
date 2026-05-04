import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
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

const BATCH_SEND_INTERVAL = 60000; // Send coordinates every 60 seconds (battery optimization)
const MIN_LOCATION_DISTANCE = 10; // Minimum 10 meters between tracked points
// AsyncStorage prefix for the unsent-coords queue. Each in-memory push to
// batchCoordinatesRef also writes here so a crash mid-journey doesn't lose
// the path between the last successful 60s sync and the crash.
const PENDING_COORDS_KEY_PREFIX = 'pendingJourneyCoords:';

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
  stopJourneyRecording: () => Promise<void>;
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
        timeInterval: 2000,
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

          // Fetch journey details from backend
          try {
            const { journey: fetchedJourney } = await getActiveJourney();
            if (fetchedJourney) {
              setJourney(fetchedJourney);
              setPolyline(fetchedJourney.polyline || []);
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
              const restored = fetchedJourney.polyline || [];
              if (restored.length > 0) {
                lastCoordinateRef.current = restored[restored.length - 1];
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

  // Listen to app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [isTracking, isPaused]);

  const handleAppStateChange = useCallback(
    async (nextAppState: any) => {
      const currentAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      // App went to background
      if (currentAppState.match(/active/) && nextAppState === 'background') {
        if (isTracking && !isPaused) {
          logger.debug('[Journey] App backgrounded - foreground watcher continues while app is in recent apps');
          // Note: Without expo-task-manager, tracking relies on foreground watcher
          // which continues briefly in background on most devices
        }
      }

      // App came to foreground
      if (nextAppState === 'active' && currentAppState.match(/inactive|background/)) {
        logger.debug('[Journey] App foregrounded');
      }
    },
    [isTracking, isPaused]
  );

  const startJourneyRecording = useCallback(
    async (title?: string) => {
      try {
        setError(null);

        // Request location permissions
        const foregroundPermission = await Location.requestForegroundPermissionsAsync();
        if (!foregroundPermission.granted) {
          const err = 'Location permission denied';
          setError(err);
          throw new Error(err);
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

      // Note: No background tracking to stop (expo-task-manager not installed)

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
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to pause journey';
      setError(errorMsg);
      logger.error('[Journey] pauseJourneyRecording failed:', err);
      throw err;
    }
  }, []);

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

      // Restart location watcher via the centralized helper.
      await startLocationWatcher();

      logger.debug('[Journey] Resumed journey:', journeyIdRef.current);
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to resume journey';
      setError(errorMsg);
      logger.error('[Journey] resumeJourneyRecording failed:', err);
      throw err;
    }
  }, []);

  const stopJourneyRecording = useCallback(async () => {
    try {
      setError(null);

      if (!journeyIdRef.current) {
        throw new Error('No active journey');
      }

      // Stop location tracking
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }

      // Note: No background tracking to stop (expo-task-manager not installed)

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

      // Call API
      const { journey: completedJourney } = await completeJourney(completingJourneyId);
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
      broadcastJourneyStateChanged();
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to stop journey';
      setError(errorMsg);
      logger.error('[Journey] stopJourneyRecording failed:', err);
      throw err;
    }
  }, []);

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
