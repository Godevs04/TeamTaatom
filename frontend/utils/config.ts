import Constants from 'expo-constants';
import { Platform } from 'react-native';
import logger from './logger';

/**
 * Centralized configuration utility
 * Reads from environment variables and app.json extra config
 * Priority: process.env.EXPO_PUBLIC_* > Constants.expoConfig?.extra > fallback defaults
 * 
 * For web in development: Auto-detect IP from current hostname to avoid IP mismatch
 */

// Helper to get API base URL with auto-detection for web
// Made as a function to ensure it's evaluated at runtime, not module load time
// NEVER uses localhost - always uses IP from .env or auto-detection
export const getApiBaseUrl = (): string => {
  // CRITICAL: For web, ALWAYS use .env IP first (most reliable)
  // Then fallback to auto-detection if .env is not available
  if (Platform.OS === 'web') {
    // Priority 1: Check environment variable (trimmed to handle spaces)
    // EXPLICITLY reject wrong IP (192.168.1.10) and localhost
    const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (envUrl && envUrl !== '' && !envUrl.includes('localhost') && !envUrl.includes('192.168.1.10')) {
      logger.debug(`[Config] ✅ [WEB] Using .env API URL: ${envUrl}`);
      return envUrl;
    } else if (envUrl && (envUrl.includes('192.168.1.10') || envUrl.includes('localhost'))) {
      logger.error(`[Config] ❌ [WEB] Rejected .env URL (wrong IP or localhost): ${envUrl}`);
      logger.error(`[Config] ❌ [WEB] Please update .env: EXPO_PUBLIC_API_BASE_URL=http://192.168.1.15:3000`);
    }
    
    // Priority 2: Auto-detect from current hostname if window is available
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      // Auto-detect if hostname is an IP address (not localhost)
      if (hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') || 
          hostname.startsWith('172.') ||
          (hostname !== 'localhost' && /^\d+\.\d+\.\d+\.\d+$/.test(hostname))) {
        // Extract IP from current hostname (e.g., 192.168.1.15:8081 -> 192.168.1.15:3000)
        const port = '3000';
        const detectedUrl = `http://${hostname}:${port}`;
        logger.debug(`[Config] 🌐 [WEB] Auto-detected API URL: ${detectedUrl} (from hostname: ${hostname})`);
        return detectedUrl;
      }
    }
    
    // Priority 3: Fallback to app.json config (should have IP, not localhost)
    const fallbackUrl = Constants.expoConfig?.extra?.API_BASE_URL;
    if (fallbackUrl && !fallbackUrl.includes('localhost')) {
      logger.warn(`[Config] ⚠️  [WEB] Using app.json API URL: ${fallbackUrl}`);
      return fallbackUrl;
    }
    
    // Last resort for web: Use default IP
    logger.error(`[Config] ❌ [WEB] No valid API URL found! Using default: http://192.168.1.15:3000`);
    return 'http://192.168.1.15:3000';
  }
  
  // For mobile: Use .env or app.json
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (envUrl && envUrl !== '' && !envUrl.includes('localhost')) {
    return envUrl;
  }
  
  const fallbackUrl = Constants.expoConfig?.extra?.API_BASE_URL;
  if (fallbackUrl && !fallbackUrl.includes('localhost')) {
    return fallbackUrl;
  }
  
  return 'http://192.168.1.15:3000';
};

// API Configuration - Use getter function for dynamic evaluation
export const API_BASE_URL = getApiBaseUrl();

// Web Share URL (for sharing posts externally)
export const WEB_SHARE_URL =
  process.env.EXPO_PUBLIC_WEB_SHARE_URL ||
  Constants.expoConfig?.extra?.WEB_SHARE_URL ||
  API_BASE_URL.replace('http://', 'https://').replace(':3000', '');

// Logo Image URL
export const LOGO_IMAGE =
  process.env.EXPO_PUBLIC_LOGO_IMAGE ||
  Constants.expoConfig?.extra?.LOGO_IMAGE ||
  'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png';

// Google Configuration
export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID ||
  '';

export const GOOGLE_CLIENT_ID_IOS =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ||
  Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID_IOS ||
  GOOGLE_CLIENT_ID;

export const GOOGLE_CLIENT_ID_ANDROID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID ||
  Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID_ANDROID ||
  GOOGLE_CLIENT_ID;

// NOTE: GOOGLE_CLIENT_SECRET is intentionally NOT exported here
// Client secrets should NEVER be exposed to the frontend bundle
// The secret should only be used on the backend server

export const GOOGLE_REDIRECT_URI =
  process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ||
  Constants.expoConfig?.extra?.GOOGLE_REDIRECT_URI ||
  '';

// Google Maps API Key
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  Constants.expoConfig?.extra?.GOOGLE_MAPS_API_KEY ||
  '';

// WebSocket Configuration
export const WS_PATH = '/socket.io';

// App Configuration
export const APP_NAME = Constants.expoConfig?.name || 'Taatom';
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
export const APP_SCHEME = Constants.expoConfig?.scheme || 'taatom';

// Environment
export const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Helper function to get share URL for posts
export const getPostShareUrl = (postId: string): string => {
  return `${WEB_SHARE_URL}/post/${postId}`;
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl().replace(/\/$/, ''); // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
};

