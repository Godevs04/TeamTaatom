/**
 * Ad cap tracker — enforces the "3 Google AdMob ads per user per 8h rolling
 * window" rule, shared across the home feed (posts), shorts feed (reels), and
 * Connect website preview. The window starts at the user's first ad
 * impression and runs in the background; once it expires the count resets to
 * zero and the website-dedup set is cleared (per spec: "session lifetime for
 * website-revisit dedup = cleared on 8h cap reset").
 *
 * Persisted in AsyncStorage so the cap survives app restarts and deep-link
 * cold starts. Exposes a useAdCap() hook so feed screens re-render the moment
 * the cap is reached and stop interspersing ad slots.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@taatom/adCap/v1';
const MAX_GOOGLE_ADS = 3;
const WINDOW_MS = 8 * 60 * 60 * 1000; // 8 hours

type AdCapState = {
  /** Number of Google AdMob impressions in the current window. */
  count: number;
  /** Epoch ms of the FIRST impression in the current window. null = window not started. */
  windowStart: number | null;
  /** Set (serialized as array) of website domains shown in the current window —
   *  revisits get a TAATOM house ad instead of a fresh Google ad. */
  websitesShownInWindow: string[];
};

const EMPTY_STATE: AdCapState = {
  count: 0,
  windowStart: null,
  websitesShownInWindow: [],
};

// Module-level cache. Loaded from AsyncStorage on first access; mutated in
// place by record/markWebsite calls. The hook subscribes via the listener
// set so all consumers re-render when the cache changes.
let cache: AdCapState | null = null;
let loadPromise: Promise<AdCapState> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* swallow — a listener crashing must not break others */ }
  });
}

function isWindowExpired(state: AdCapState, now: number): boolean {
  if (state.windowStart == null) return false;
  return now - state.windowStart >= WINDOW_MS;
}

function freshState(): AdCapState {
  return { count: 0, windowStart: null, websitesShownInWindow: [] };
}

/** Resolve the in-memory cache, applying window-expiry pruning if needed. */
async function ensureLoaded(): Promise<AdCapState> {
  if (cache) {
    if (isWindowExpired(cache, Date.now())) {
      cache = freshState();
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
          cache = freshState();
        } else {
          const parsed = JSON.parse(raw) as Partial<AdCapState>;
          cache = {
            count: typeof parsed.count === 'number' ? parsed.count : 0,
            windowStart: typeof parsed.windowStart === 'number' ? parsed.windowStart : null,
            websitesShownInWindow: Array.isArray(parsed.websitesShownInWindow)
              ? parsed.websitesShownInWindow.filter((d): d is string => typeof d === 'string')
              : [],
          };
        }
      } catch {
        cache = freshState();
      }
      if (isWindowExpired(cache, Date.now())) {
        cache = freshState();
        await persist(cache);
      }
      return cache;
    })();
  }
  return loadPromise;
}

async function persist(state: AdCapState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // AsyncStorage failure is non-fatal — in-memory cache continues to work
    // for the session; persistence will retry on next mutation.
  }
}

/** Synchronous read of the current cap state. Returns EMPTY_STATE before the
 *  first ensureLoaded() resolves; the hook below triggers the load. */
export function getAdCapSnapshot(): AdCapState {
  return cache ?? EMPTY_STATE;
}

/** True iff a Google AdMob ad slot is allowed to render right now. */
export function canShowGoogleAd(): boolean {
  const state = cache ?? EMPTY_STATE;
  if (state.windowStart != null && isWindowExpired(state, Date.now())) {
    // Window has expired since last load — treat as fresh. The next
    // ensureLoaded() (triggered by hook or impression) will commit the reset.
    return true;
  }
  return state.count < MAX_GOOGLE_ADS;
}

/** Returns 0..MAX_GOOGLE_ADS — useful for "limit slots to N more" math. */
export function getRemainingGoogleAdSlots(): number {
  const state = cache ?? EMPTY_STATE;
  if (state.windowStart != null && isWindowExpired(state, Date.now())) {
    return MAX_GOOGLE_ADS;
  }
  return Math.max(0, MAX_GOOGLE_ADS - state.count);
}

/** Record one Google AdMob impression. Starts the 8h window if this is the
 *  first impression. No-op if the cap is already reached (defensive — the
 *  caller should already have gated the slot on canShowGoogleAd()). */
export async function recordGoogleAdImpression(): Promise<void> {
  const state = await ensureLoaded();
  // Re-check after the await — if the window expired during load, the cache
  // was already reset by ensureLoaded().
  if (state.count >= MAX_GOOGLE_ADS) return;
  const now = Date.now();
  state.count += 1;
  if (state.windowStart == null) {
    state.windowStart = now;
  }
  await persist(state);
  notifyListeners();
}

/** Has this website domain already been served a Google ad in the current
 *  8h window? Used by the website browser to decide Google vs TAATOM ad. */
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

/** React hook: subscribes to the cap and re-renders on changes. Triggers the
 *  initial AsyncStorage load on mount. Components can read isCapped /
 *  remainingSlots reactively. */
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

  const expired = snapshot.windowStart != null && isWindowExpired(snapshot, Date.now());
  const effectiveCount = expired ? 0 : snapshot.count;
  return {
    count: effectiveCount,
    isCapped: effectiveCount >= MAX_GOOGLE_ADS,
    remainingSlots: Math.max(0, MAX_GOOGLE_ADS - effectiveCount),
    windowStart: expired ? null : snapshot.windowStart,
  };
}

export const AD_CAP_MAX = MAX_GOOGLE_ADS;
export const AD_CAP_WINDOW_MS = WINDOW_MS;
