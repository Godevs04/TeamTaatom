import React, { createContext, useContext, ReactNode } from 'react';
import { useJourneyTracking } from '../hooks/useJourneyTracking';
import { Journey, Coordinate } from '../types/journey';

/**
 * Single shared journey-tracking instance for the whole app tree.
 *
 * Why this exists:
 *   `useJourneyTracking()` was previously called directly from at least 5
 *   screens (root layout's JourneyStatusBar, navigate/index, navigate/
 *   tracking, navigate/complete, map/current-location). Each call mounted
 *   its own React state, refs, GPS watcher, batch-send timer, and
 *   AsyncStorage replay logic. We added a module-level pub/sub broadcast
 *   to keep them in sync, but the duplicated GPS watchers were burning
 *   battery and the duplicated batch-send timers were racing each other
 *   to POST the same coords.
 *
 *   Lifting the hook into a Context provider mounted once at the root
 *   collapses every consumer onto a single instance — one watcher, one
 *   batch timer, one duration ticker.
 */

interface JourneyContextValue {
  initialized: boolean;
  isTracking: boolean;
  isPaused: boolean;
  journey: Journey | null;
  polyline: Coordinate[];
  distance: number;
  duration: number;
  accuracy: number | null;
  currentCoordinate: Coordinate | null;
  error: string | null;
  startJourneyRecording: (title?: string) => Promise<void>;
  pauseJourneyRecording: () => Promise<void>;
  resumeJourneyRecording: () => Promise<void>;
  stopJourneyRecording: (options?: { snapToRoads?: boolean }) => Promise<void>;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);

export const JourneyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Single call site. All other screens read from useJourney() below.
  // Note: useJourneyTracking internally handles saving/rehydrating state
  // from AsyncStorage to ensure active journeys survive app termination.
  const value = useJourneyTracking();
  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  );
};

/**
 * Read the shared journey state. Replaces direct `useJourneyTracking()`
 * imports in screens. Throws if used outside the provider so a missing
 * mount surfaces immediately rather than silently spinning up a duplicate
 * watcher (which is the bug this whole module was created to prevent).
 */
export const useJourney = (): JourneyContextValue => {
  const ctx = useContext(JourneyContext);
  if (!ctx) {
    throw new Error('useJourney must be used inside <JourneyProvider> (mounted in app/_layout.tsx)');
  }
  return ctx;
};
