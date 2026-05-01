/**
 * FX rate service for INR-base subscription pricing.
 *
 * Pricing source of truth is INR (because Cashfree only charges INR), but
 * fans abroad see localized "≈ $11" / "≈ €10" prices. This service produces
 * the conversion factor: 1 INR → X foreign units.
 *
 * Resolution order (each step falls through to the next on failure):
 *   1. In-memory cache (fastest, no I/O).
 *   2. Live fetch from open.er-api.com (free, no API key, ~250k req/mo).
 *   3. Persisted last-known-good in Mongo (FxRateCache).
 *   4. Hardcoded fallback table (so the app NEVER fails to show prices,
 *      even if Mongo and the FX API are both unreachable).
 *
 * In-memory TTL is 6h — that's a deliberate tradeoff. Real interbank rates
 * move <1% intraday for the currencies we care about, so 6h-old rates are
 * accurate to within rounding noise. Refreshing more often just adds load
 * to the free-tier API without buying us anything.
 *
 * No new package deps: uses Node's built-in https module (same approach as
 * cashfreeService.js). Adding fluent-ffmpeg-style runtime deps to a
 * production backend has been pushback before, so we keep this dep-free.
 */

const https = require('https');
const logger = require('../utils/logger');
const FxRateCache = require('../models/FxRateCache');

// Hardcoded last-resort rates. Updated periodically to track ~3-month
// average; any drift is bounded since we'd only ever land here when both
// the API and our DB cache are unavailable. Rates are "1 INR = X target".
const HARDCODED_RATES = {
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  AUD: 0.018,
  CAD: 0.016,
  SGD: 0.016,
  AED: 0.044,
  JPY: 1.85,
  KRW: 16.5,
  THB: 0.42,
  INR: 1,
};

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const REFRESH_TIMEOUT_MS = 5000; // 5s — never block a request for an FX refresh

let cachedRates = null;
let cachedAt = 0;
let cachedSource = null;

/**
 * GET https://open.er-api.com/v6/latest/INR using built-in https.
 * Returns { rates: {...} } or throws.
 */
function fetchLiveRatesViaHttps() {
  return new Promise((resolve, reject) => {
    const req = https.get('https://open.er-api.com/v6/latest/INR', (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`FX API returned HTTP ${res.statusCode}`));
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.result === 'success' && parsed.rates && typeof parsed.rates === 'object') {
            resolve(parsed.rates);
          } else {
            reject(new Error(`FX API payload unrecognized: ${parsed.result || 'no result field'}`));
          }
        } catch (e) {
          reject(new Error(`FX API JSON parse failed: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(REFRESH_TIMEOUT_MS, () => {
      req.destroy();
      reject(new Error('FX API request timed out'));
    });
  });
}

/**
 * Refresh in-memory cache + persist to Mongo. Returns the rates used (always
 * resolves — never throws — to guarantee callers get something).
 */
async function refreshRates() {
  // Try the live API first.
  try {
    const liveRates = await fetchLiveRatesViaHttps();
    cachedRates = liveRates;
    cachedAt = Date.now();
    cachedSource = 'api';
    logger.info('[FX] Live rates fetched from open.er-api.com');
    // Persist for next cold start. Don't block on this.
    FxRateCache.findOneAndUpdate(
      { scope: 'inr_base' },
      { rates: liveRates, source: 'api', fetchedAt: new Date() },
      { upsert: true, new: true }
    ).catch((e) => logger.warn('[FX] Failed to persist rates to Mongo:', e.message));
    return liveRates;
  } catch (apiErr) {
    logger.warn('[FX] Live rate fetch failed:', apiErr.message);
  }

  // Fall through to last-known-good in Mongo.
  try {
    const doc = await FxRateCache.getInstance();
    if (doc.rates && Object.keys(doc.rates).length > 0) {
      cachedRates = doc.rates;
      cachedAt = Date.now();
      cachedSource = doc.source || 'fallback';
      logger.info(`[FX] Using persisted rates (source: ${cachedSource}, fetchedAt: ${doc.fetchedAt})`);
      return cachedRates;
    }
  } catch (dbErr) {
    logger.warn('[FX] Mongo cache read failed:', dbErr.message);
  }

  // Last resort: hardcoded.
  cachedRates = HARDCODED_RATES;
  cachedAt = Date.now();
  cachedSource = 'fallback';
  logger.warn('[FX] Using HARDCODED fallback rates (API + DB both unavailable)');
  return cachedRates;
}

async function getInrRates() {
  if (cachedRates && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedRates;
  }
  return refreshRates();
}

/**
 * Convert an INR amount to a target currency. Returns null if the currency
 * isn't in our table (caller should fall back to displaying INR).
 */
async function convertFromInr(inrAmount, targetCurrency) {
  if (!Number.isFinite(inrAmount) || inrAmount <= 0) return null;
  if (targetCurrency === 'INR') return inrAmount;
  const rates = await getInrRates();
  const rate = rates[targetCurrency];
  return rate ? inrAmount * rate : null;
}

/**
 * Build the displayPrices object that the page-detail endpoint returns.
 * Only computes rates for the 11 currencies we explicitly support
 * (currencyConfig.js); anything else is silently dropped.
 *
 * Rounding: floor to nearest whole unit for cleaner UX ($10 not $10.85).
 * JPY/KRW round to whole numbers anyway since they have 0 decimals.
 *
 * Each entry is marked { approximate: true } EXCEPT INR — fans need to
 * know the foreign-currency display is approximate because Cashfree
 * still actually charges INR and their bank does the final FX hop.
 */
async function buildDisplayPrices(inrAmount) {
  const { CURRENCIES } = require('../utils/currencyConfig');
  const out = {};

  // INR — exact, source of truth.
  const inrCfg = CURRENCIES.INR;
  out.INR = {
    amount: inrAmount,
    currency: 'INR',
    symbol: inrCfg.symbol,
    formatted: `${inrCfg.symbol}${inrAmount.toLocaleString()}`,
    approximate: false,
  };

  // All other supported currencies — approximate.
  for (const code of Object.keys(CURRENCIES)) {
    if (code === 'INR') continue;
    const converted = await convertFromInr(inrAmount, code);
    if (converted == null) continue;
    const cfg = CURRENCIES[code];
    const rounded = cfg.decimals === 0 ? Math.round(converted) : Math.floor(converted);
    out[code] = {
      amount: rounded,
      currency: code,
      symbol: cfg.symbol,
      formatted: `≈ ${cfg.symbol}${rounded.toLocaleString()}`,
      approximate: true,
    };
  }

  return {
    prices: out,
    rateSource: cachedSource || 'unknown',
    fetchedAt: cachedAt ? new Date(cachedAt).toISOString() : null,
  };
}

/**
 * Optional: warm the cache once at server start so the very first
 * page-detail request doesn't pay the API round-trip latency.
 */
async function warmCache() {
  try {
    await refreshRates();
  } catch (e) {
    logger.warn('[FX] Warm cache failed (non-fatal):', e.message);
  }
}

module.exports = {
  getInrRates,
  convertFromInr,
  buildDisplayPrices,
  refreshRates,
  warmCache,
  HARDCODED_RATES,
};
