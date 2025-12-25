/**
 * Policy URL Constants
 * These URLs are read from environment variables for production-grade configuration
 */

export const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://taatom.com/privacy';

export const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_URL || 'https://taatom.com/terms';

export const COPYRIGHT_URL =
  process.env.EXPO_PUBLIC_COPYRIGHT_URL || 'https://taatom.com/copyright';

