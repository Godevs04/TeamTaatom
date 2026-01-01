/**
 * Policy URL Constants
 * These URLs are derived from WEB_SHARE_URL, API_BASE_URL (in development), or production domain
 * Policy pages are appended to the base URL: /privacy, /terms, /copyright
 * 
 * Development: Uses API_BASE_URL (localhost/local IP) so policies work locally
 * Production: Uses WEB_SHARE_URL or production domain
 */

import { WEB_SHARE_URL, getApiBaseUrl } from '../utils/config';
import logger from '../utils/logger';

/**
 * Get the base URL for policy pages
 * Priority: EXPO_PUBLIC_WEB_SHARE_URL > WEB_SHARE_URL > API_BASE_URL (dev only) > Production domain
 * 
 * In development, we use API_BASE_URL so policies can be served from the backend
 * In production, we use WEB_SHARE_URL or production domain
 */
const getPolicyBaseUrl = (): string => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production';
  
  // Priority 1: Check for explicit policy base URL in environment
  const policyBaseUrl = process.env.EXPO_PUBLIC_WEB_SHARE_URL?.trim();
  if (policyBaseUrl && policyBaseUrl !== '') {
    // In production, reject localhost/local IP
    if (isProduction && (policyBaseUrl.includes('localhost') || policyBaseUrl.includes('192.168.') || policyBaseUrl.includes('127.0.0.1'))) {
      logger.warn('⚠️ [Policies] EXPO_PUBLIC_WEB_SHARE_URL contains localhost/local IP in production. Using production domain instead.');
    } else {
      return policyBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    }
  }
  
  // Priority 2: Use WEB_SHARE_URL if it's a production URL (not localhost/local IP)
  if (WEB_SHARE_URL && WEB_SHARE_URL.trim() !== '') {
    const webShareUrl = WEB_SHARE_URL.trim();
    // Only use if it's not localhost or local IP
    if (!webShareUrl.includes('localhost') && !webShareUrl.includes('192.168.') && !webShareUrl.includes('127.0.0.1')) {
      return webShareUrl.replace(/\/$/, ''); // Remove trailing slash
    }
  }
  
  // Priority 3: In development, use API_BASE_URL so policies work locally
  if (!isProduction) {
    const apiBaseUrl = getApiBaseUrl();
    if (apiBaseUrl && apiBaseUrl.trim() !== '') {
      // Use API base URL in development (backend can serve policy files)
      return apiBaseUrl.trim().replace(/\/$/, ''); // Remove trailing slash
    }
  }
  
  // Priority 4: Use production domain as fallback (only in production)
  const productionDomain = 'https://taatom.com';
  
  if (isProduction) {
    logger.warn('⚠️ [Policies] Using production domain fallback. Consider setting EXPO_PUBLIC_WEB_SHARE_URL in .env for production builds');
  }
  
  return productionDomain;
};

/**
 * Helper to build policy URL from base URL and path
 */
const buildPolicyUrl = (path: string): string => {
  const baseUrl = getPolicyBaseUrl();
  if (!baseUrl) {
    return '';
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
};

// Export policy URLs derived from base URL
export const PRIVACY_URL = buildPolicyUrl('/privacy');
export const TERMS_URL = buildPolicyUrl('/terms');
export const COPYRIGHT_URL = buildPolicyUrl('/copyright');

