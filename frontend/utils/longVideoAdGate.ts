import AsyncStorage from '@react-native-async-storage/async-storage';

/** Must match the backend LONG_VIDEO_VIEW_WINDOW_MS: one ad break per viewer per video every 8 hours. */
export const LONG_VIDEO_AD_WINDOW_MS = 8 * 60 * 60 * 1000;

const STORAGE_KEY = 'taatom_long_video_ad_windows';

type AdWindows = Record<string, number>;

async function readWindows(): Promise<AdWindows> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Device-side backstop for the server's 8h window: covers leaving before the view event is
 * recorded, and offline playback.
 */
export async function canShowLongVideoAds(videoId: string): Promise<boolean> {
  const windows = await readWindows();
  const startedAt = windows[videoId];
  return !startedAt || Date.now() - startedAt >= LONG_VIDEO_AD_WINDOW_MS;
}

export async function markLongVideoAdsShown(videoId: string): Promise<void> {
  const now = Date.now();
  const windows = await readWindows();
  const next: AdWindows = { [videoId]: now };
  for (const [id, startedAt] of Object.entries(windows)) {
    if (id !== videoId && now - startedAt < LONG_VIDEO_AD_WINDOW_MS) next[id] = startedAt;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Server-side window still applies.
  }
}
