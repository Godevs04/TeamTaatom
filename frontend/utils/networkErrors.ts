/**
 * True when a request or media load failed because the network did not answer (offline, connection
 * dropped, timed out), as opposed to the server or the media itself being broken.
 *
 * Covers raw Axios / NSURL errors and the user-facing messages services rethrow
 * (`throw new Error(parsedError.userMessage)`), which drop the original code.
 * These failures are expected on mobile networks: callers log them as warnings and
 * the logger keeps them out of Sentry.
 */
export const isNetworkFailure = (error: any): boolean => {
  if (!error) return false;

  const code = error?.code;
  if (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ETIMEDOUT' ||
    code === -1001 || code === '-1001' || // iOS timed out
    code === -1005 || code === '-1005' || // iOS connection lost
    code === -1009 || code === '-1009' // iOS offline
  ) {
    return true;
  }

  const message = typeof error === 'string' ? error : String(error?.message || '');
  return /network error|network timeout|timeout|timed out|took too long|unable to connect to the server|network request failed|network offline/i.test(message);
};
