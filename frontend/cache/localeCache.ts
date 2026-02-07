/**
 * Module-level cache for Locale data
 * Persists across navigation and screen remounts
 * 
 * This cache survives:
 * - Screen unmount
 * - Navigation back
 * - Tab switches
 * - Component remounts
 */

import { Locale } from '../services/locale';

export interface LocationSnapshot {
  lat: number;
  lon: number;
  city: string | null;
  region: string | null;
  countryCode: string | null;
  snapshotKey: string;
}

export const localeCache = {
  /**
   * Fully sorted locale list (after distance calculation and sorting)
   */
  allLocalesSorted: null as (Locale & { distanceKm?: number | null })[] | null,
  
  /**
   * Location snapshot key that was used to generate the sorted list
   * Used to verify cache validity when location changes
   */
  locationSnapshotKey: null as string | null,
  
  /**
   * Location snapshot object (for reference)
   */
  locationSnapshot: null as LocationSnapshot | null,
  
  /**
   * Invalidate the cache
   * Call this when:
   * - User manually refreshes
   * - Filters change
   * - Location changes significantly
   */
  invalidate() {
    this.allLocalesSorted = null;
    this.locationSnapshotKey = null;
    this.locationSnapshot = null;
  },
  
  /**
   * Check if cache is valid for a given location snapshot key
   */
  isValid(snapshotKey: string | null): boolean {
    return (
      this.allLocalesSorted !== null &&
      this.allLocalesSorted.length > 0 &&
      this.locationSnapshotKey === snapshotKey &&
      snapshotKey !== null
    );
  },
  
  /**
   * Store cached data
   */
  set(
    locales: (Locale & { distanceKm?: number | null })[],
    snapshot: LocationSnapshot
  ) {
    this.allLocalesSorted = locales;
    this.locationSnapshotKey = snapshot.snapshotKey;
    this.locationSnapshot = snapshot;
  },
  
  /**
   * Get cached data
   */
  get(): {
    locales: (Locale & { distanceKm?: number | null })[];
    snapshot: LocationSnapshot;
  } | null {
    if (this.allLocalesSorted === null || this.locationSnapshot === null) {
      return null;
    }
    
    return {
      locales: this.allLocalesSorted,
      snapshot: this.locationSnapshot,
    };
  },
};
