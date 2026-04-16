/**
 * Production Environment Validator
 * Validates that production builds have all required configuration
 */

import logger from './logger';
import { getApiBaseUrl, WEB_SHARE_URL, PRIVACY_POLICY_URL } from './config';
import { getGoogleMapsApiKey } from './maps';

/**
 * Validates production environment configuration
 * Returns validation report for startup checks.
 */
export const validateProductionEnvironment = (): { ok: boolean; errors: string[]; warnings: string[] } => {
  const isProduction = process.env.EXPO_PUBLIC_ENV === 'production' || process.env.NODE_ENV === 'production';
  
  if (!isProduction) {
    // Skip hard validation in development
    return { ok: true, errors: [], warnings: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate API Base URL
  try {
    const apiUrl = getApiBaseUrl();
    if (apiUrl.includes('localhost') || apiUrl.includes('192.168.') || apiUrl.includes('10.') || apiUrl.includes('172.')) {
      errors.push(`❌ API_BASE_URL is set to localhost or local IP: ${apiUrl}`);
      errors.push('   Production builds must use a production API URL (e.g., https://api.taatom.com)');
    }
    if (!apiUrl.startsWith('https://')) {
      warnings.push(`⚠️  API_BASE_URL is not using HTTPS: ${apiUrl}`);
      warnings.push('   Production should use HTTPS for security');
    }
  } catch (error: any) {
    errors.push(`❌ Failed to get API_BASE_URL: ${error.message}`);
  }

  // Validate Web Share URL
  if (WEB_SHARE_URL) {
    if (WEB_SHARE_URL.includes('localhost') || WEB_SHARE_URL.includes('192.168.') || WEB_SHARE_URL.includes('10.') || WEB_SHARE_URL.includes('172.')) {
      errors.push(`❌ WEB_SHARE_URL is set to localhost or local IP: ${WEB_SHARE_URL}`);
    }
    if (!WEB_SHARE_URL.startsWith('https://')) {
      warnings.push(`⚠️  WEB_SHARE_URL is not using HTTPS: ${WEB_SHARE_URL}`);
    }
  } else {
    warnings.push('⚠️  WEB_SHARE_URL is not set');
  }

  // Validate Privacy Policy URL (required for App Store)
  if (!PRIVACY_POLICY_URL) {
    warnings.push('⚠️  PRIVACY_POLICY_URL is not set');
    warnings.push('   App Store submission requires a privacy policy URL');
  } else if (!PRIVACY_POLICY_URL.startsWith('https://')) {
    warnings.push(`⚠️  PRIVACY_POLICY_URL is not using HTTPS: ${PRIVACY_POLICY_URL}`);
  }

  // Validate Google Maps API Key (using the same logic as the app)
  // Note: Missing key is not an error - app gracefully falls back to Apple Maps on iOS
  try {
    const mapsApiKey = getGoogleMapsApiKey();
    if (!mapsApiKey) {
      // Log as debug, not warning, since the app handles this gracefully
      // iOS will use Apple Maps, Android will use fallback
      // This prevents Sentry from reporting it as an error
      logger.debug('[ProductionValidator] Google Maps API key not set - app will use fallback map providers');
    } else {
      logger.debug('[ProductionValidator] Google Maps API key is configured');
    }
  } catch (error: any) {
    // Don't add to warnings/errors - just log debug
    // This prevents Sentry from reporting validation errors
    logger.debug('[ProductionValidator] Error checking Google Maps API key:', error.message);
  }

  // Validate Sentry DSN
  const sentryDsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!sentryDsn) {
    warnings.push('⚠️  EXPO_PUBLIC_SENTRY_DSN is not set');
    warnings.push('   Error tracking will be disabled');
  }

  // Log warnings as info instead of warn to prevent Sentry from reporting them
  // These are informational configuration suggestions, not critical errors
  if (warnings.length > 0) {
    logger.info('Production environment configuration notes:');
    warnings.forEach(warning => logger.info(warning));
  }

  // Throw errors in production
  if (errors.length > 0) {
    const errorMessage = `\n🚨 PRODUCTION CONFIGURATION ERRORS:\n${errors.join('\n')}\n\n` +
      `Please fix these issues before deploying to production.\n` +
      `Set the required environment variables in your .env file or EAS build secrets.\n`;
    
    logger.error(errorMessage);
    return { ok: false, errors, warnings };
  }

  // Log success
  logger.info('✅ Production environment validation passed');
  return { ok: true, errors, warnings };
};

