/**
 * Ad cap tracker and View Telemetry Engine.
 * Enforces "10 Google AdMob ads per 8 hours" separately for each placement: home feed,
 * shorts, and Connect website preview each have their own counter and window (the window starts
 * at that placement's first impression). Feed ads sit at fixed positions (after post 5, 10, 15, …)
 * on every visit / refresh until the placement's cap is reached.
 *
 * Implements:
 *   1. 30-second app startup ignored window.
 *   2. Rolling 8-hour deduplicated view counter matrix (1 view per 8h).
 *   3. Unified cross-feature scroll sequence ad injection.
 *
 * Persisted in AsyncStorage so state survives app restarts and crashes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useMemo, useState } from 'react';
import { trackPostView } from './analytics';
import logger from '../utils/logger';

const STORAGE_KEY = '@taatom/adCap/v1';
const MAX_GOOGLE_ADS = 10;
const WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours
const LAUNCH_DELAY_MS = __DEV__ ? 5000 : 5 * 60 * 1000; // 5 minutes (5s in dev)
const VIEW_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  /** Placement + content-count milestones that already produced an ad impression (kept for
   *  analytics/back-compat only — positions are no longer skipped because of it). */
  shownAdMilestones: string[];
  /** Independent 10-per-8h counters per placement ('home', 'shorts', 'website'). Each window
   *  starts at that placement's first impression. */
  placements: Record<string, PlacementCap>;
}

export type AdPlacement = 'home' | 'shorts' | 'website';
export type PlacementCap = { count: number; windowStart: number | null };

const EMPTY_STATE: AdCapState = {
  count: 0,
  windowStart: null,
  websitesShownInWindow: [],
  appLaunchTimestamp: 0,
  userContentViewMatrix: {},
  postDelayViews: [],
  ignoredIds: [],
  shownAdMilestones: [],
  placements: {},
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
    shownAdMilestones: [],
    placements: {},
  };
}

function isPlacementExpired(cap: PlacementCap | undefined, now: number): boolean {
  return !!cap && cap.windowStart != null && now - cap.windowStart >= WINDOW_MS;
}

/** Current count for a placement, treating an expired window as empty. */
function placementCount(state: AdCapState, placement: string, now: number): number {
  const cap = state.placements?.[placement];
  if (!cap || isPlacementExpired(cap, now)) return 0;
  return cap.count;
}

function parsePlacements(raw: unknown): Record<string, PlacementCap> {
  const out: Record<string, PlacementCap> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [key, value] of Object.entries(raw as Record<string, any>)) {
    if (value && typeof value.count === 'number') {
      out[key] = {
        count: value.count,
        windowStart: typeof value.windowStart === 'number' ? value.windowStart : null,
      };
    }
  }
  return out;
}

function adMilestoneKey(placement: string, threshold: number): string {
  return `${placement}:${threshold}`;
}

/** Resolve the in-memory cache, applying window-expiry pruning if needed. */
async function ensureLoaded(): Promise<AdCapState> {
  if (cache) {
    const now = Date.now();
    if (isWindowExpired(cache, now)) {
      cache = {
        ...freshState(cache.appLaunchTimestamp),
        appLaunchTimestamp: cache.appLaunchTimestamp,
        placements: cache.placements,
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
            shownAdMilestones: Array.isArray(parsed.shownAdMilestones)
              ? parsed.shownAdMilestones.filter((m): m is string => typeof m === 'string')
              : [],
            placements: parsePlacements(parsed.placements),
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
          placements: cache.placements,
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

/** True iff a Google AdMob ad slot for this placement is allowed to render right now. */
export function canShowGoogleAd(placement: AdPlacement = 'home'): boolean {
  return placementCount(getAdCapSnapshot(), placement, Date.now()) < MAX_GOOGLE_ADS;
}

/** Returns 0..MAX_GOOGLE_ADS for this placement — useful for remaining ads math. */
export function getRemainingGoogleAdSlots(placement: AdPlacement = 'home'): number {
  return Math.max(0, MAX_GOOGLE_ADS - placementCount(getAdCapSnapshot(), placement, Date.now()));
}

type AdMilestone = {
  placement: string;
  threshold: number;
};

/** True when this placement/count milestone already produced an impression in the current window. */
export function hasShownAdMilestone(milestone: AdMilestone): boolean {
  return getAdCapSnapshot().shownAdMilestones.includes(
    adMilestoneKey(milestone.placement, milestone.threshold)
  );
}

/**
 * Record one Google AdMob impression for its placement (feed, shorts, or website — each has its
 * own 10-per-8h window, started by that placement's first impression). Every impression counts:
 * the same position (e.g. "after post 5") shows an ad again on each refresh / re-entry until the
 * placement's cap is reached.
 */
export async function recordGoogleAdImpression(milestone?: AdMilestone): Promise<boolean> {
  const state = await ensureLoaded();
  if (!cache) cache = state;
  const now = Date.now();
  const placement = milestone?.placement || 'website';

  const placements = cache.placements || (cache.placements = {});
  let cap = placements[placement];
  if (!cap || isPlacementExpired(cap, now)) {
    cap = { count: 0, windowStart: null };
    placements[placement] = cap;
  }
  if (cap.count >= MAX_GOOGLE_ADS) {
    return false;
  }
  cap.count += 1;
  if (cap.windowStart == null) cap.windowStart = now;

  if (milestone) {
    const key = adMilestoneKey(milestone.placement, milestone.threshold);
    if (!cache.shownAdMilestones.includes(key)) cache.shownAdMilestones.push(key);
  }
  // Keep the legacy aggregate fields roughly in step (view-matrix housekeeping uses windowStart).
  cache.count += 1;
  if (cache.windowStart == null) cache.windowStart = now;

  await persist(cache);
  notifyListeners();
  return true;
}

/** Has this website domain already been served a Google ad in the current window? */
export function wasWebsiteShown(domain: string): boolean {
  return false;
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

/** Home feed: one native ad after every N posts. */
export const HOME_AD_EVERY_N_POSTS = 5;

/** Shorts feed: one native ad after every N reels. */
export const SHORTS_AD_EVERY_N_REELS = 5;

type FeedAdCapOptions = {
  isCapped: boolean;
  count?: number;
  remainingSlots?: number;
  shownAdMilestones?: string[];
  /** Milestone keys already placed in the list this session. They stay in place even
   *  after their impression is recorded (or the cap is reached), so an ad never
   *  vanishes from under the user mid-scroll. */
  keepMilestones?: ReadonlySet<string>;
};

/** Milestone key for a feed ad slot (`<placement>:<threshold>`). */
export function getAdMilestoneKey(milestone: AdMilestone): string {
  return adMilestoneKey(milestone.placement, milestone.threshold);
}

function injectPositionalFeedAds<T>(
  items: T[],
  everyN: number,
  placement: string,
  options: FeedAdCapOptions
): (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] {
  const keep = options.keepMilestones;
  if (items.length === 0 || (options.isCapped && !keep?.size)) {
    return items;
  }

  const result: (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] = [];
  let contentCount = 0;
  let adIndex = 0;

  for (const item of items) {
    result.push(item);
    contentCount += 1;
    if (contentCount % everyN === 0 && contentCount < items.length) {
      const milestone = { placement, threshold: contentCount };
      const key = adMilestoneKey(placement, contentCount);
      const alreadyPlaced = !!keep?.has(key);
      // Positions are fixed (5, 10, 15, …) on every visit; only the placement's cap stops new slots.
      const allowed = !options.isCapped;
      if (alreadyPlaced || allowed) {
        result.push({ type: 'ad', adIndex, milestone });
      }
      adIndex += 1;
    }
  }

  return result;
}

/** Inserts ad slots after posts 5, 10, 15, 20, 25, … (home feed's own 10-per-8h cap). */
export function injectHomeFeedAds<T>(
  items: T[],
  options: FeedAdCapOptions
): (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] {
  return injectPositionalFeedAds(items, HOME_AD_EVERY_N_POSTS, 'home', options);
}

/** Inserts ad slots after reels 5, 10, 15, 20, 25 (shared 5-per-8h impression cap). */
export function injectShortsFeedAds<T>(
  items: T[],
  options: FeedAdCapOptions
): (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] {
  return injectPositionalFeedAds(items, SHORTS_AD_EVERY_N_REELS, 'shorts', options);
}

/**
 * Dynamic unified ad intersperser (shorts / cross-feature view sequencing).
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
    shownAdMilestones?: string[];
  }
): (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] {
  if (
    adCapState.isCapped ||
    adCapState.count >= MAX_GOOGLE_ADS ||
    items.length === 0 ||
    (Date.now() - adCapState.appLaunchTimestamp) < LAUNCH_DELAY_MS
  ) {
    return items;
  }

  const result: (T | { type: 'ad'; adIndex: number; milestone: AdMilestone })[] = [];
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
        const milestone = { placement: 'shorts', threshold: globalIndex };
        if (!adCapState.shownAdMilestones?.includes(adMilestoneKey('shorts', globalIndex))) {
          result.push({ type: 'ad', adIndex, milestone });
        }
      }
    }
  }

  return result;
}

/** React hook: the cap for one placement ('home' | 'shorts' | 'website'); re-renders on changes. */
export function useAdCap(placement: AdPlacement = 'home') {
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

  // Re-evaluate when the placement's 8h window ends, so ads come back without an app restart.
  const cap = snapshot.placements?.[placement];
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (!cap?.windowStart) return;
    const msLeft = cap.windowStart + WINDOW_MS - Date.now();
    if (msLeft <= 0) return;
    const t = setTimeout(() => forceTick((n) => n + 1), Math.min(msLeft + 1000, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [cap?.windowStart]);

  const now = Date.now();
  const expired = isPlacementExpired(cap, now);
  const currentCount = !cap || expired ? 0 : cap.count;

  // Stable identity per snapshot so consumers' useMemo/useCallback deps don't churn every render.
  return useMemo(() => {
    const globalExpired = snapshot.windowStart != null && isWindowExpired(snapshot, now);
    return {
      placement,
      count: currentCount,
      isCapped: currentCount >= MAX_GOOGLE_ADS,
      remainingSlots: Math.max(0, MAX_GOOGLE_ADS - currentCount),
      windowStart: !cap || expired ? null : cap.windowStart,
      postDelayViews: globalExpired ? [] : snapshot.postDelayViews,
      ignoredIds: snapshot.ignoredIds,
      appLaunchTimestamp: snapshot.appLaunchTimestamp,
      // Positions no longer skip "already shown" slots; exposed empty for older callers.
      shownAdMilestones: [] as string[],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, placement, currentCount, expired]);
}

export const AD_CAP_MAX = MAX_GOOGLE_ADS;
export const AD_CAP_WINDOW_MS = WINDOW_MS;

// Eagerly pre-load state on module import to prevent cold-start race conditions.
ensureLoaded().catch((err) => {
  logger.error('Failed to pre-load adCap state:', err);
});
