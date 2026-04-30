/**
 * Multi-currency configuration for Connect subscriptions
 *
 * Each currency defines:
 *   code     — ISO 4217 currency code
 *   symbol   — Display symbol
 *   name     — Human-readable name
 *   minPrice — Minimum subscription price (in base units)
 *   maxPrice — Maximum subscription price
 *   decimals — Number of decimal places (0 for JPY/KRW)
 */

const CURRENCIES = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', minPrice: 100, maxPrice: 10000, decimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', minPrice: 1, maxPrice: 200, decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', minPrice: 1, maxPrice: 200, decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', minPrice: 1, maxPrice: 200, decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', minPrice: 2, maxPrice: 300, decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', minPrice: 2, maxPrice: 300, decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', minPrice: 2, maxPrice: 300, decimals: 2 },
  AED: { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', minPrice: 5, maxPrice: 750, decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', minPrice: 150, maxPrice: 30000, decimals: 0 },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', minPrice: 1500, maxPrice: 300000, decimals: 0 },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', minPrice: 40, maxPrice: 7000, decimals: 2 },
};

/**
 * ISO country code → currency mapping
 * Auto-detects currency based on creator's country
 */
const COUNTRY_TO_CURRENCY = {
  // INR
  IN: 'INR',
  // USD
  US: 'USD',
  // EUR — Eurozone
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR',
  SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR',
  MT: 'EUR', HR: 'EUR',
  // GBP
  GB: 'GBP',
  // AUD
  AU: 'AUD',
  // CAD
  CA: 'CAD',
  // SGD
  SG: 'SGD',
  // AED
  AE: 'AED',
  // JPY
  JP: 'JPY',
  // KRW
  KR: 'KRW',
  // THB
  TH: 'THB',
};

// All supported currency codes
const SUPPORTED_CURRENCIES = Object.keys(CURRENCIES);

/**
 * Get currency config for a given currency code
 * Falls back to USD if unsupported
 */
const getCurrencyConfig = (code) => {
  return CURRENCIES[code] || CURRENCIES.USD;
};

/**
 * Get currency code from country code
 * Falls back to USD for unmapped countries
 */
const getCurrencyFromCountry = (countryCode) => {
  if (!countryCode) return 'USD';
  return COUNTRY_TO_CURRENCY[countryCode.toUpperCase()] || 'USD';
};

/**
 * Validate price for a given currency
 */
const validatePrice = (price, currencyCode) => {
  const config = getCurrencyConfig(currencyCode);
  if (typeof price !== 'number' || isNaN(price)) return { valid: false, error: 'Price must be a number' };
  if (price < config.minPrice) return { valid: false, error: `Minimum price is ${config.symbol}${config.minPrice}` };
  if (price > config.maxPrice) return { valid: false, error: `Maximum price is ${config.symbol}${config.maxPrice}` };
  return { valid: true };
};

/**
 * Format price with currency symbol
 */
const formatPrice = (amount, currencyCode) => {
  const config = getCurrencyConfig(currencyCode);
  const formatted = config.decimals === 0
    ? Math.round(amount).toLocaleString()
    : amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${config.symbol}${formatted}`;
};

/**
 * Check if a country is international (non-India)
 */
const isInternational = (countryCode) => {
  return countryCode && countryCode.toUpperCase() !== 'IN';
};

module.exports = {
  CURRENCIES,
  COUNTRY_TO_CURRENCY,
  SUPPORTED_CURRENCIES,
  getCurrencyConfig,
  getCurrencyFromCountry,
  validatePrice,
  formatPrice,
  isInternational,
};
