/**
 * Authentication helper utilities
 * Handles token storage based on platform (web vs mobile)
 */

const logger = require('./logger');

/**
 * Set authentication token in response
 * Uses httpOnly cookies for web, returns token in response for mobile
 * @param {Object} res - Express response object
 * @param {string} token - JWT token
 * @param {Object} req - Express request object (to detect platform)
 * @returns {Object} - Response data with token (for mobile) or without (for web)
 */
const setAuthToken = (res, token, req) => {
  // Check platform header first (more reliable)
  const platform = req.headers['x-platform'];
  const userAgent = req.headers['user-agent'] || '';
  const isWeb = platform === 'web' || (userAgent.includes('Mozilla') && !userAgent.includes('Mobile') && !userAgent.includes('Android') && !userAgent.includes('iPhone'));
  
  // For web, set httpOnly cookie
  if (isWeb) {
    const isProduction = process.env.NODE_ENV === 'production';
    const origin = req.headers.origin || '';
    const backendHost = req.get('host') || '';
    const forwardedHost = (req.headers['x-forwarded-host'] || '').split(',')[0].trim();

    // The browser uses one host (e.g. 192.168.1.36:3001 via Next) while the API may see
    // Host: localhost:3000 — that is *not* cross-site for the cookie: the response still
    // returns to the browser on the page origin, so Set-Cookie applies to 192.168.1.36.
    // Old logic skipped the cookie in that case and only returned JSON → 401 after redirect
    // or when sessionStorage was empty.
    const isSameOrigin =
      (origin && backendHost && origin.includes(backendHost.split(':')[0])) ||
      (origin.includes('localhost') && backendHost.includes('localhost')) ||
      (forwardedHost && origin.includes(forwardedHost.split(':')[0]));

    res.cookie('authToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    // Dev: still return token body when origin/host disagree so axios sessionStorage fallback works
    if (!isProduction && !isSameOrigin) {
      logger.debug('Dev proxied/LAN auth: cookie set; token also returned for sessionStorage fallback');
      return { token };
    }

    return {};
  }
  
  // For mobile, return token in response (will be stored in AsyncStorage)
  return { token };
};

/**
 * Clear authentication token
 * @param {Object} res - Express response object
 */
const clearAuthToken = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.clearCookie('authToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    path: '/'
  });
};

/**
 * Get token from request (cookie for web, header for mobile)
 * @param {Object} req - Express request object
 * @returns {string|null} - Token or null
 */
const getAuthToken = (req) => {
  // Check cookie first (web)
  if (req.cookies && req.cookies.authToken) {
    return req.cookies.authToken;
  }
  
  // Check Authorization header (mobile)
  const authHeader = req.header('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '');
  }
  
  return null;
};

/**
 * Debug function to log cookie information
 */
const _debugCookies = (req) => {
  const logger = require('./logger');
  logger.debug('Cookies received:', req.cookies);
  logger.debug('Cookie header:', req.headers.cookie);
  logger.debug('Platform:', req.headers['x-platform']);
  logger.debug('User-Agent:', req.headers['user-agent']);
};

/**
 * Normalize IP address (strip IPv6-mapped prefix, trim).
 * @param {string} ip
 * @returns {string}
 */
function normalizeIP(ip) {
  if (!ip || typeof ip !== 'string') return '';
  let value = ip.trim();
  if (value.startsWith('::ffff:')) {
    value = value.slice(7);
  }
  return value;
}

/**
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateIP(ip) {
  const value = normalizeIP(ip);
  if (!value || value === 'Unknown') return true;
  if (value === '127.0.0.1' || value === '::1' || value === 'localhost') return true;
  if (value.startsWith('192.168.') || value.startsWith('10.')) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(value)) return true;
  if (value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80')) return true;
  return false;
}

/**
 * Extract real client IP address from request
 * Handles proxies, load balancers, and CDNs
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIP = (req) => {
  const pickPublicIP = (ips) => {
    for (const raw of ips) {
      const ip = normalizeIP(raw);
      if (ip && !isPrivateIP(ip)) return ip;
    }
    return normalizeIP(ips[0] || '');
  };

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean);
    const chosen = pickPublicIP(ips);
    if (chosen) return chosen;
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return normalizeIP(realIP);
  }

  const cfConnectingIP = req.headers['cf-connecting-ip'];
  if (cfConnectingIP) {
    return normalizeIP(cfConnectingIP);
  }

  return normalizeIP(req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'Unknown');
};

/**
 * Build a readable location label from geolocation parts.
 * @param {{ city?: string, region?: string, country?: string, country_name?: string }} parts
 * @returns {string}
 */
function formatLocationParts(parts) {
  const city = parts.city?.trim();
  const region = parts.region?.trim();
  const country = (parts.country_name || parts.country)?.trim();
  return [city, region, country].filter(Boolean).join(', ');
}

/**
 * Extract client-reported location from sign-in body or header (mobile GPS).
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function parseClientLoginLocation(req) {
  const bodyLoc = req.body?.loginLocation;
  if (bodyLoc && typeof bodyLoc === 'object') {
    const label = typeof bodyLoc.label === 'string' ? bodyLoc.label.trim() : '';
    if (label) return label;
    const formatted = formatLocationParts(bodyLoc);
    if (formatted) return formatted;
  }

  const headerLoc = req.headers['x-client-location'];
  if (typeof headerLoc === 'string' && headerLoc.trim()) {
    try {
      const parsed = JSON.parse(headerLoc);
      if (parsed && typeof parsed === 'object') {
        const label = typeof parsed.label === 'string' ? parsed.label.trim() : '';
        if (label) return label;
        const formatted = formatLocationParts(parsed);
        if (formatted) return formatted;
      }
    } catch {
      return headerLoc.trim();
    }
  }

  return null;
}

/**
 * Parse user-agent into a friendly device label for login emails.
 * @param {string} userAgent
 * @returns {string}
 */
function formatLoginDevice(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return 'Unknown device';
  const ua = userAgent;

  if (ua.includes('Expo') || ua.includes('CFNetwork') || ua.includes('Darwin')) {
    if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('Darwin')) {
      return 'Taatom on iOS';
    }
    if (ua.includes('Android')) {
      return 'Taatom on Android';
    }
    return 'Taatom mobile app';
  }

  if (ua.includes('okhttp') || (ua.includes('Android') && !ua.includes('Mozilla'))) {
    return 'Taatom on Android';
  }

  const lower = ua.toLowerCase();
  let browser = 'Browser';
  let os = 'Unknown OS';

  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/') && !lower.includes('edg')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/') && !lower.includes('chrome')) browser = 'Safari';
  else if (lower.includes('opera') || lower.includes('opr/')) browser = 'Opera';

  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('mac os') || lower.includes('macintosh')) os = 'macOS';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad')) os = 'iOS';
  else if (lower.includes('linux')) os = 'Linux';

  return `${browser} on ${os}`;
}

async function fetchGeoFromIpApiCo(ipAddress) {
  const fetch = (...args) => import('node-fetch').then((m) => m.default(...args));
  const geoRes = await fetch(`https://ipapi.co/${encodeURIComponent(ipAddress)}/json/`, {
    headers: { 'User-Agent': 'Taatom/1.0' },
  });
  if (!geoRes.ok) return null;
  const geo = await geoRes.json();
  if (geo.error) return null;
  return formatLocationParts({
    city: geo.city,
    region: geo.region,
    country_name: geo.country_name,
  }) || null;
}

async function fetchGeoFromIpApiCom(ipAddress) {
  const fetch = (...args) => import('node-fetch').then((m) => m.default(...args));
  const geoRes = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ipAddress)}?fields=status,city,regionName,country`,
    { headers: { 'User-Agent': 'Taatom/1.0' } }
  );
  if (!geoRes.ok) return null;
  const geo = await geoRes.json();
  if (geo.status !== 'success') return null;
  return formatLocationParts({
    city: geo.city,
    region: geo.regionName,
    country_name: geo.country,
  }) || null;
}

/**
 * Get location from IP address using multiple providers.
 * @param {string} ipAddress
 * @returns {Promise<string>}
 */
const getLocationFromIP = async (ipAddress) => {
  const ip = normalizeIP(ipAddress);
  if (!ip || isPrivateIP(ip)) {
    return '';
  }

  try {
    const fromIpApiCo = await fetchGeoFromIpApiCo(ip);
    if (fromIpApiCo) return fromIpApiCo;
  } catch (error) {
    logger.warn(`ipapi.co lookup failed for ${ip}:`, error.message);
  }

  try {
    const fromIpApiCom = await fetchGeoFromIpApiCom(ip);
    if (fromIpApiCom) return fromIpApiCom;
  } catch (error) {
    logger.warn(`ip-api.com lookup failed for ${ip}:`, error.message);
  }

  return '';
};

/**
 * Resolve login device + location for security notification emails.
 * Prefers client GPS when IP is private or geolocation fails.
 * @param {import('express').Request} req
 * @returns {Promise<{ ip: string, device: string, location: string }>}
 */
async function resolveLoginContext(req) {
  const ip = normalizeIP(getClientIP(req));
  const device = formatLoginDevice(req.headers['user-agent'] || '');
  const clientLocation = parseClientLoginLocation(req);

  if (clientLocation) {
    return { ip, device, location: clientLocation };
  }

  const ipLocation = await getLocationFromIP(ip);
  if (ipLocation) {
    return { ip, device, location: ipLocation };
  }

  if (isPrivateIP(ip)) {
    return { ip, device, location: 'Local network' };
  }

  return { ip, device, location: '' };
}

module.exports = {
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  getClientIP,
  getLocationFromIP,
  resolveLoginContext,
  formatLoginDevice,
};

