/**
 * Ad cap tracker and View Telemetry Engine.
 * Enforces the "5 Google AdMob ads per user per 8h rolling window" rule,
 * shared across the home feed (posts), shorts feed (reels), and Connect website preview.
 *
 * Implements:
 *   1. 30-second app startup ignored window.
 *   2. Rolling 8-hour deduplicated view counter matrix (1 view per 8h).
 *   3. Unified cross-feature scroll sequence ad injection.
 *
 * Persisted in AsyncStorage so state survives app restarts and crashes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { trackPostView } from './analytics';
import logger from '../utils/logger';

const STORAGE_KEY = '@taatom/adCap/v1';
const MAX_GOOGLE_ADS = 5;
const WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours
const LAUNCH_DELAY_MS = 30000; // 30 seconds
const VIEW_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

export interface ContentViewEntry {
  contentId: string;
  type: 'post' | 'short' | 'website';
  firstViewedAt: number;
  lastIncrementedAt: number;
  viewCount: number;
  ignored: boolean;
}

export interface AdCapState {
  /** Number of Google AdMob impressions in the current window. */
  count: number;
  /** Epoch ms of the FIRST impression in the current window. null = window not started. */
  windowStart: number | null;
  /** Set (serialized as array) of website domains shown in the current window —
   *  revisits get a TAATOM house ad instead of a fresh Google ad. */
  websitesShownInWindow: string[];
  /** App launch timestamp */
  appLaunchTimestamp: number;
  /** Mapping of contentId -> ContentViewEntry */
  userContentViewMatrix: Record<string, ContentViewEntry>;
  /** Unified scroll sequence tracker for post-delay views */
  postDelayViews: string[];
  /** Set of unique IDs viewed during the 30-second app startup ignored window */
  ignoredIds: string[];
}

const EMPTY_STATE: AdCapState = {
  count: 0,
  windowStart: null,
  websitesShownInWindow: [],
  appLaunchTimestamp: 0,
  userContentViewMatrix: {},
  postDelayViews: [],
  ignoredIds: [],
};

// Module-level variables
const currentSessionStartup = Date.now();
let cache: AdCapState | null = null;
let loadPromise: Promise<AdCapState> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* swallow — a listener crashing must not break others */
    }
  });
}

function isWindowExpired(state: AdCapState, now: number): boolean {
  if (state.windowStart == null) return false;
  return now - state.windowStart >= WINDOW_MS;
}

function freshState(startupTime: number): AdCapState {
  return {
    count: 0,
    windowStart: null,
    websitesShownInWindow: [],
    appLaunchTimestamp: startupTime,
    userContentViewMatrix: {},
    postDelayViews: [],
    ignoredIds: [],
  };
}

/** Resolve the in-memory cache, applying window-expiry pruning if needed. */
async function ensureLoaded(): Promise<AdCapState> {
  if (cache) {
    const now = Date.now();
    if (isWindowExpired(cache, now)) {
      cache = {
        ...freshState(cache.appLaunchTimestamp),
        appLaunchTimestamp: cache.appLaunchTimestamp,
      };
      await persist(cache);
      notifyListeners();
    }
    return cache;
  }
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          cache = freshState(currentSessionStartup);
        } else {
          const parsed = JSON.parse(raw) as Partial<AdCapState>;
          cache = {
            count: typeof parsed.count === 'number' ? parsed.count : 0,
            windowStart: typeof parsed.windowStart === 'number' ? parsed.windowStart : null,
            websitesShownInWindow: Array.isArray(parsed.websitesShownInWindow)
              ? parsed.websitesShownInWindow.filter((d): d is string => typeof d === 'string')
              : [],
            appLaunchTimestamp: currentSessionStartup, // Always anchor to current cold-start startup
            userContentViewMatrix: parsed.userContentViewMatrix || {},
            postDelayViews: Array.isArray(parsed.postDelayViews) ? parsed.postDelayViews : [],
            ignoredIds: Array.isArray(parsed.ignoredIds) ? parsed.ignoredIds : [],
          };
        }
      } catch {
        cache = freshState(currentSessionStartup);
      }

      const now = Date.now();
      if (isWindowExpired(cache, now)) {
        cache = {
          ...freshState(currentSessionStartup),
          appLaunchTimestamp: cache.appLaunchTimestamp,
        };
      }

      // Commit state immediately to storage
      await persist(cache);

      // Start 30s localized timer to trigger initial state update for listeners
      setTimeout(() => {
        notifyListeners();
      }, LAUNCH_DELAY_MS);

      return cache;
    })();
  }
  return loadPromise;
}

async function persist(state: AdCapState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.error('Failed to persist ad engine state:', error);
  }
}

/** Synchronous read of the current state. Returns EMPTY_STATE before the first ensureLoaded() resolves. */
export function getAdCapSnapshot(): AdCapState {
  return cache ?? EMPTY_STATE;
}

/** True iff a Google AdMob ad slot is allowed to render right now. */
export function canShowGoogleAd(): boolean {
  const state = cache ?? EMPTY_STATE;
  if (state.windowStart != null && isWindowExpired(state, Date.now())) {
    return true;
  }
  return state.count < MAX_GOOGLE_ADS;
}

/** Returns 0..MAX_GOOGLE_ADS — useful for remaining ads math. */
export function getRemainingGoogleAdSlots(): number {
  const state = cache ?? EMPTY_STATE;
  if (state.windowStart != null && isWindowExpired(state, Date.now())) {
    return MAX_GOOGLE_ADS;
  }
  return Math.max(0, MAX_GOOGLE_ADS - state.count);
}

/** Record one Google AdMob impression. Starts the 8h window if this is the first impression. */
export async function recordGoogleAdImpression(): Promise<void> {
  const state = await ensureLoaded();
  const now = Date.now();
  if (isWindowExpired(state, now)) {
    // Reset if window has expired
    const nextState = {
      ...freshState(state.appLaunchTimestamp),
      appLaunchTimestamp: state.appLaunchTimestamp,
    };
    cache = nextState;
    await persist(cache);
  }

  if (cache && cache.count < MAX_GOOGLE_ADS) {
    cache.count += 1;
    if (cache.windowStart == null) {
      cache.windowStart = now;
    }
    await persist(cache);
    notifyListeners();
  }
}

/** Has this website domain already been served a Google ad in the current window? */
export function wasWebsiteShown(domain: string): boolean {
  const state = cache ?? EMPTY_STATE;
  if (state.windowStart != null && isWindowExpired(state, Date.now())) return false;
  return state.websitesShownInWindow.includes(domain);
}

/** Mark a website domain as having received a Google ad in the current window. */
export async function markWebsiteShown(domain: string): Promise<void> {
  const state = await ensureLoaded();
  if (state.websitesShownInWindow.includes(domain)) return;
  state.websitesShownInWindow.push(domain);
  await persist(state);
  notifyListeners();
}

/**
 * Track and log a content view under rolling 8-hour deduplication rules.
 * Handles the 30-second app-launch ignored window and active content counters.
 */
export async function logContentView(
  contentId: string,
  type: 'post' | 'short' | 'website',
  properties?: Record<string, any>
): Promise<{ incremented: boolean; ignored: boolean }> {
  const state = await ensureLoaded();
  const now = Date.now();

  // 1. Check if within the 30s app startup ignored window
  const isIgnored = (now - state.appLaunchTimestamp) < LAUNCH_DELAY_MS;

  const entry = state.userContentViewMatrix[contentId];
  let incremented = false;

  if (!entry) {
    // Fresh view: increment count
    state.userContentViewMatrix[contentId] = {
      contentId,
      type,
      firstViewedAt: now,
      lastIncrementedAt: now,
      viewCount: 1,
      ignored: isIgnored,
    };
    incremented = true;
  } else {
    // Check rolling 8-hour expiration
    const hasExpired = (now - entry.firstViewedAt) >= VIEW_EXPIRY_MS;
    if (hasExpired) {
      // Expiration Renewal: reset window and increment count
      state.userContentViewMatrix[contentId] = {
        contentId,
        type,
        firstViewedAt: now,
        lastIncrementedAt: now,
        viewCount: entry.viewCount + 1,
        ignored: isIgnored,
      };
      incremented = true;
    } else {
      // Within 8 hours: suppress view increment
      // matrix is updated with the last access time, but view count does not increment
      state.userContentViewMatrix[contentId].lastIncrementedAt = now;
    }
  }

  // 2. Track sequences for ad placement
  if (isIgnored) {
    if (!state.ignoredIds.includes(contentId)) {
      state.ignoredIds.push(contentId);
    }
  } else {
    // If not ignored and it's a new or renewed unique view
    if (incremented) {
      if (!state.postDelayViews.includes(contentId)) {
        state.postDelayViews.push(contentId);
      }
    }
  }

  await persist(state);
  notifyListeners();

  // 3. Trigger actual analytics track only if we incremented view count
  if (incremented) {
    try {
      if (type === 'post' || type === 'short') {
        trackPostView(contentId, properties);
      } else if (type === 'website') {
        const { track } = require('./analytics');
        track('website_view', { page_id: contentId, ...properties });
      }
    } catch (error) {
      logger.error('Error tracking view in logContentView:', error);
    }
  }

  return { incremented, ignored: isIgnored };
}

/**
 * Dynamic unified ad intersperser.
 * Intersperse ads into a list of items based on sequence indices 6, 12, 18, 24, 30.
 * If the user has reached the 5-ad limit, no ads are injected.
 */
export function injectAds<T extends { _id: string }>(
  items: T[],
  adCapState: {
    count: number;
    isCapped: boolean;
    postDelayViews: string[];
    ignoredIds: string[];
    appLaunchTimestamp: number;
  }
): (T | { type: 'ad'; adIndex: number })[] {
  if (
    adCapState.isCapped ||
    adCapState.count >= MAX_GOOGLE_ADS ||
    items.length === 0 ||
    (Date.now() - adCapState.appLaunchTimestamp) < LAUNCH_DELAY_MS
  ) {
    return items;
  }

  const result: (T | { type: 'ad'; adIndex: number })[] = [];
  let unviewedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    result.push(item);

    if (adCapState.ignoredIds.includes(item._id)) {
      continue;
    }

    // Determine the global index of this unignored item
    let globalIndex = 0;
    const viewIdx = adCapState.postDelayViews.indexOf(item._id);
    if (viewIdx !== -1) {
      globalIndex = viewIdx + 1;
    } else {
      globalIndex = adCapState.postDelayViews.length + unviewedCount + 1;
      unviewedCount++;
    }

    // Check if an ad should be injected after this item (global indices 6, 12, 18, 24, 30)
    if (
      globalIndex === 6 ||
      globalIndex === 12 ||
      globalIndex === 18 ||
      globalIndex === 24 ||
      globalIndex === 30
    ) {
      const adIndex = Math.floor(globalIndex / 6) - 1;
      if (adIndex >= 0 && adIndex < MAX_GOOGLE_ADS) {
        result.push({ type: 'ad', adIndex });
      }
    }
  }

  return result;
}

/** React hook: subscribes to the cap and re-renders on changes. */
export function useAdCap() {
  const [snapshot, setSnapshot] = useState<AdCapState>(() => getAdCapSnapshot());

  useEffect(() => {
    let cancelled = false;
    ensureLoaded().then((state) => {
      if (!cancelled) setSnapshot({ ...state });
    });
    const onChange = () => {
      if (!cancelled) setSnapshot({ ...(cache ?? EMPTY_STATE) });
    };
    listeners.add(onChange);
    return () => {
      cancelled = true;
      listeners.delete(onChange);
    };
  }, []);

  const now = Date.now();
  const expired = snapshot.windowStart != null && isWindowExpired(snapshot, now);
  const effectiveCount = expired ? 0 : snapshot.count;

  return {
    count: effectiveCount,
    isCapped: effectiveCount >= MAX_GOOGLE_ADS,
    remainingSlots: Math.max(0, MAX_GOOGLE_ADS - effectiveCount),
    windowStart: expired ? null : snapshot.windowStart,
    postDelayViews: expired ? [] : snapshot.postDelayViews,
    ignoredIds: snapshot.ignoredIds,
    appLaunchTimestamp: snapshot.appLaunchTimestamp,
  };
}

export const AD_CAP_MAX = MAX_GOOGLE_ADS;
export const AD_CAP_WINDOW_MS = WINDOW_MS;
