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

interface UseJourneyTrackingReturn {
  initialized: boolean;
  isTracking: boolean;
  isPaused: boolean;
  journey: Journey | null;
  polyline: Coordinate[];
  distance: number;
  duration: number;
  accuracy: number | null;
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

  // Note: Background task registration removed (expo-task-manager not installed)
  // Foreground tracking via watchPositionAsync is used instead

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
              // Calculate duration from startedAt
              if (fetchedJourney.startedAt) {
                const elapsed = Math.floor((Date.now() - new Date(fetchedJourney.startedAt).getTime()) / 1000);
                setDuration(Math.max(0, elapsed));
              }
              setIsPaused(fetchedJourney.status === 'paused');
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

    initializeJourney();
  }, []);

  // Duration timer - updates every second
  useEffect(() => {
    if (isTracking && !isPaused && startTimeRef.current) {
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current!) / 1000);
        setDuration(elapsed);
      }, 1000);

      return () => {
        if (durationTimerRef.current) {
          clearInterval(durationTimerRef.current);
        }
      };
    }
  }, [isTracking, isPaused]);

  // Batch send coordinates every 30 seconds
  useEffect(() => {
    if (isTracking && !isPaused && journeyIdRef.current && batchCoordinatesRef.current.length > 0) {
      batchSendTimerRef.current = setInterval(async () => {
        if (batchCoordinatesRef.current.length > 0) {
          try {
            const coords = batchCoordinatesRef.current.splice(0);
            await updateJourneyLocation(journeyIdRef.current!, coords);
            logger.debug(`[Journey] Sent ${coords.length} coordinates to backend`);
          } catch (err) {
            logger.error('[Journey] Failed to update location:', err);
            // Re-add to batch for retry
            batchCoordinatesRef.current.unshift(...(err as any).coords || []);
          }
        }
      }, BATCH_SEND_INTERVAL);

      return () => {
        if (batchSendTimerRef.current) {
          clearInterval(batchSendTimerRef.current);
        }
      };
    }
  }, [isTracking, isPaused]);

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

        // Set state
        setJourney(newJourney);
        setIsTracking(true);
        setIsPaused(false);
        setDistance(0);
        setDuration(0);

        // Start foreground location watching
        if (Platform.OS !== 'web') {
          locationWatcherRef.current = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              distanceInterval: MIN_LOCATION_DISTANCE,
              timeInterval: 5000,
            },
            (location) => {
              const coord: Coordinate = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                timestamp: location.timestamp,
                accuracy: location.coords.accuracy || 0,
              };

              setAccuracy(coord.accuracy);

              // Only add to polyline if far enough from last point
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

                  // Update distance
                  setDistance((prev) => prev + dist);

                  // Add to batch
                  batchCoordinatesRef.current.push(coord);
                }
              }
            }
          );
        }

        logger.debug('[Journey] Started journey recording:', newJourney._id);
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
        } catch (err) {
          logger.error('[Journey] Failed to send final coordinates:', err);
        }
      }

      // Call API to pause
      const { journey: pausedJourney } = await pauseJourney(journeyIdRef.current);
      setJourney(pausedJourney);
      setIsPaused(true);

      logger.debug('[Journey] Paused journey:', journeyIdRef.current);
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

      // Restart location watcher
      if (Platform.OS !== 'web') {
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: MIN_LOCATION_DISTANCE,
            timeInterval: 5000,
          },
          (location) => {
            const coord: Coordinate = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              timestamp: location.timestamp,
              accuracy: location.coords.accuracy || 0,
            };

            setAccuracy(coord.accuracy);

            // Only add to polyline if far enough from last point
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

                // Update distance
                setDistance((prev) => prev + dist);

                // Add to batch
                batchCoordinatesRef.current.push(coord);
              }
            }
          }
        );
      }

      logger.debug('[Journey] Resumed journey:', journeyIdRef.current);
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

      // Send final coordinates
      if (batchCoordinatesRef.current.length > 0) {
        const coords = batchCoordinatesRef.current.splice(0);
        try {
          await updateJourneyLocation(journeyIdRef.current, coords);
        } catch (err) {
          logger.error('[Journey] Failed to send final coordinates:', err);
        }
      }

      // Call API
      const { journey: completedJourney } = await completeJourney(journeyIdRef.current);
      setJourney(completedJourney);
      setIsTracking(false);
      setIsPaused(false);

      // Clear from storage
      await AsyncStorage.removeItem('activeJourneyId');

      logger.debug('[Journey] Completed journey:', journeyIdRef.current);
      journeyIdRef.current = null;
      startTimeRef.current = null;
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
    error,
    startJourneyRecording,
    pauseJourneyRecording,
    resumeJourneyRecording,
    stopJourneyRecording,
  };
}
