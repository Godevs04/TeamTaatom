/**
 * Public host the client actually used to reach us.
 *
 * The web app proxies `/api/v1/*` through its own origin (Next.js rewrite), which
 * replaces `Host` with the backend's host but preserves the original in
 * `X-Forwarded-Host`. Absolute URLs we hand back (e.g. HLS playlist proxies) must
 * use the public host, or the browser is sent cross-origin straight to the
 * backend and playback fails on CORS / mixed content. Mobile calls the backend
 * directly, so it has no forwarded host and keeps using `Host`.
 *
 * @param {import('express').Request} req
 * @returns {string} host (with port when present), or '' when unknown
 */
const getRequestHost = (req) => {
  const forwardedHost = req?.headers?.['x-forwarded-host'];
  if (typeof forwardedHost === 'string' && forwardedHost.trim()) {
    return forwardedHost.split(',')[0].trim();
  }
  return (req?.get?.('host') || req?.headers?.host || '').trim();
};

module.exports = { getRequestHost };
