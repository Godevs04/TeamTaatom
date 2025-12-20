import Constants from 'expo-constants';

/**
 * Centralized configuration utility
 * Reads from environment variables and app.json extra config
 * Priority: process.env.EXPO_PUBLIC_* > Constants.expoConfig?.extra > fallback defaults
 */

// API Configuration
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.API_BASE_URL ||
  'http://localhost:3000';

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
  const baseUrl = API_BASE_URL.replace(/\/$/, ''); // Remove trailing slash
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${baseUrl}${path}`;
};

