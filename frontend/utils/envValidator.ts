/**
 * Environment Variable Validator
 * Validates that all exposed environment variables are safe for client-side use
 * 
 * CRITICAL: This file should be imported at app startup to validate environment variables
 * and prevent secrets from being exposed to the client bundle.
 */

import Constants from 'expo-constants';
import logger from './logger';

/**
 * List of environment variables that are SAFE to expose to client-side
 * These are public configuration values that are meant to be accessible in the browser/app
 */
const SAFE_CLIENT_VARS = [
  'EXPO_PUBLIC_API_BASE_URL',
  'EXPO_PUBLIC_WEB_SHARE_URL',
  'EXPO_PUBLIC_LOGO_IMAGE',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS',
  'EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID',
  'EXPO_PUBLIC_GOOGLE_REDIRECT_URI',
  'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
  'EXPO_PUBLIC_SENTRY_DSN',
  'EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE',
  'EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE',
  'EXPO_PUBLIC_ENV',
  'NODE_ENV',
] as const;

/**
 * List of environment variables that are SECRETS and MUST NEVER be exposed to client-side
 * If any of these are found, the app should fail to start in production
 */
const FORBIDDEN_SECRET_VARS = [
  'GOOGLE_CLIENT_SECRET',
  'EXPO_PUBLIC_GOOGLE_CLIENT_SECRET', // Even with EXPO_PUBLIC prefix, this is a secret
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MONGODB_URI',
  'MONGODB_PASSWORD',
  'REDIS_PASSWORD',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_ACCESS_KEY_ID',
  'CLOUDINARY_API_SECRET',
  'S3_SECRET_ACCESS_KEY',
  'SENTRY_AUTH_TOKEN',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
  'ENCRYPTION_KEY',
  'API_KEY',
  'SECRET_KEY',
  'PRIVATE_KEY',
] as const;

/**
 * Validates that no secrets are exposed in the client bundle
 * @returns true if validation passes, false if secrets are found
 */
export const validateEnvironmentVariables = (): boolean => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for forbidden secret variables
  FORBIDDEN_SECRET_VARS.forEach(secretVar => {
    // Check process.env
    if (process.env[secretVar]) {
      errors.push(`❌ SECRET EXPOSED: ${secretVar} is set in process.env and will be exposed to client!`);
    }
    
    // Check Constants.expoConfig.extra
    if (Constants.expoConfig?.extra?.[secretVar]) {
      errors.push(`❌ SECRET EXPOSED: ${secretVar} is set in app.json extra config and will be exposed to client!`);
    }
  });

  // Check for EXPO_PUBLIC_ prefixed secrets (common mistake)
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('EXPO_PUBLIC_')) {
      const varName = key.replace('EXPO_PUBLIC_', '');
      if (FORBIDDEN_SECRET_VARS.includes(varName as any) || 
          FORBIDDEN_SECRET_VARS.includes(key as any)) {
        errors.push(`❌ SECRET EXPOSED: ${key} uses EXPO_PUBLIC_ prefix but contains a secret!`);
      }
    }
  });

  // Warn about non-EXPO_PUBLIC_ variables that might be accidentally exposed
  Object.keys(process.env).forEach(key => {
    if (!key.startsWith('EXPO_PUBLIC_') && 
        !SAFE_CLIENT_VARS.includes(key as any) &&
        !FORBIDDEN_SECRET_VARS.includes(key as any) &&
        key !== 'NODE_ENV' &&
        process.env[key]) {
      // Only warn in development to avoid noise
      if (process.env.NODE_ENV === 'development') {
        warnings.push(`⚠️  ${key} is not prefixed with EXPO_PUBLIC_ and may not be accessible in client`);
      }
    }
  });

  // Log warnings in development
  if (warnings.length > 0 && process.env.NODE_ENV === 'development') {
    logger.warn('Environment variable warnings:', warnings);
  }

  // Log errors and fail in production
  if (errors.length > 0) {
    const errorMessage = `\n🚨 CRITICAL: Secrets exposed in client bundle!\n${errors.join('\n')}\n\n` +
      `These secrets will be visible in the client-side JavaScript bundle.\n` +
      `Remove them immediately and use server-side API calls instead.\n`;
    
    logger.error(errorMessage);
    
    // In production, throw error to prevent app from starting
    if (process.env.NODE_ENV === 'production') {
      throw new Error(errorMessage);
    }
    
    return false;
  }

  // Log success in development
  if (process.env.NODE_ENV === 'development') {
    logger.debug('✅ Environment variable validation passed');
  }

  return true;
};

/**
 * Gets a safe environment variable value
 * Only returns values from SAFE_CLIENT_VARS
 * @param varName - Environment variable name (with or without EXPO_PUBLIC_ prefix)
 * @returns The value or undefined if not found or not safe
 */
export const getSafeEnvVar = (varName: string): string | undefined => {
  // Normalize variable name
  const normalizedName = varName.startsWith('EXPO_PUBLIC_') 
    ? varName 
    : `EXPO_PUBLIC_${varName}`;
  
  // Check if it's a safe variable
  if (!SAFE_CLIENT_VARS.includes(normalizedName as any)) {
    if (process.env.NODE_ENV === 'development') {
      logger.warn(`⚠️  Attempted to access unsafe environment variable: ${varName}`);
    }
    return undefined;
  }

  // Return value from process.env or Constants.expoConfig.extra
  return process.env[normalizedName] || 
         Constants.expoConfig?.extra?.[normalizedName] ||
         undefined;
};

/**
 * Validates that a specific environment variable is safe to use
 * @param varName - Environment variable name
 * @returns true if safe, false otherwise
 */
export const isSafeEnvVar = (varName: string): boolean => {
  const normalizedName = varName.startsWith('EXPO_PUBLIC_') 
    ? varName 
    : `EXPO_PUBLIC_${varName}`;
  
  return SAFE_CLIENT_VARS.includes(normalizedName as any);
};

