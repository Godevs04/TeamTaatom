const WIFI_PROBE_URL = 'https://www.google.com/favicon.ico';
const WIFI_PROBE_TIMEOUT_MS = 400;

/**
 * Estimates whether the device is on a fast (WiFi-like) connection.
 * Uses a timed HEAD probe — responds within WIFI_PROBE_TIMEOUT_MS → WiFi, otherwise → cellular.
 * Heuristic only; no native netinfo library is installed.
 */
export const isOnWifi = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WIFI_PROBE_TIMEOUT_MS);
    const start = Date.now();
    await fetch(WIFI_PROBE_URL, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return (Date.now() - start) < WIFI_PROBE_TIMEOUT_MS;
  } catch {
    return false;
  }
};

/**
 * Returns true if the download should be blocked.
 * Pass wifiOnlyDownloads from the user's settings.
 * Blocked when setting is true AND device does not appear to be on WiFi.
 */
export const shouldBlockDownload = async (wifiOnlyDownloads: boolean): Promise<boolean> => {
  if (!wifiOnlyDownloads) return false;
  const onWifi = await isOnWifi();
  return !onWifi;
};
