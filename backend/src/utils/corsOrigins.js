/**
 * Shared cross-origin allow-list logic for both the REST API's `cors`
 * middleware (app.js) and the socket.io WS handshake's `cors.origin` option
 * (socket/index.js) -- extracted so the two don't drift into two different
 * definitions of "which origins are allowed to talk to this backend".
 *
 * socket.io's `cors.origin` accepts a function with the same
 * `(origin, callback)` shape as the `cors` npm package, so the same
 * allow/deny predicate (isOriginAllowed) works for both call sites.
 */

const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

const normalizeOrigin = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '').toLowerCase();
};

const withApexAndWwwVariants = (origins) => {
  const out = new Set();
  origins.forEach((origin) => {
    const normalized = normalizeOrigin(origin);
    if (!normalized) return;
    out.add(normalized);
    if (normalized.startsWith('https://www.')) {
      out.add(normalized.replace('https://www.', 'https://'));
    } else if (normalized.startsWith('https://')) {
      const host = normalized.replace('https://', '');
      if (!host.startsWith('admin.')) {
        out.add(`https://www.${host}`);
      }
    }
  });
  return [...out];
};

const devPatterns = [
  /^http:\/\/localhost:\d+$/,
  /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
  /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
];

/** Production allow-list: FRONTEND_URL, WEB_FRONTEND_URL, SUPERADMIN_URL (+ apex/www variants). */
function getProductionOrigins() {
  return withApexAndWwwVariants([
    process.env.FRONTEND_URL,
    process.env.WEB_FRONTEND_URL,
    process.env.SUPERADMIN_URL,
  ]);
}

/** Dev allow-list: the same three env vars plus hardcoded local dev fallbacks. */
function getDevOrigins() {
  return withApexAndWwwVariants([
    process.env.FRONTEND_URL,
    process.env.WEB_FRONTEND_URL,
    process.env.SUPERADMIN_URL,
    ...(isDevelopment
      ? [
          'http://localhost:5003',
          'http://localhost:8081',
          'http://localhost:3001',
          'http://x:8081',
          'http://x:3000',
          'file://',
          'null',
        ]
      : []),
  ]);
}

/**
 * True if `origin` should be allowed cross-origin access. `origin` is the
 * raw Origin header value (or undefined for no-origin requests like mobile
 * apps, Postman, or same-process calls).
 */
function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalizedOrigin = normalizeOrigin(origin);

  if (isProduction) {
    return !!(normalizedOrigin && getProductionOrigins().includes(normalizedOrigin));
  }

  const devOrigins = getDevOrigins();
  if (normalizedOrigin && devOrigins.includes(normalizedOrigin)) return true;
  if (isDevelopment && devPatterns.some((pattern) => pattern.test(origin))) return true;
  return false;
}

module.exports = {
  isOriginAllowed,
  normalizeOrigin,
  withApexAndWwwVariants,
  getProductionOrigins,
  getDevOrigins,
};
