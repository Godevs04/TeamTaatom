import { Platform } from 'react-native';
import Constants from 'expo-constants';
import logger from './logger';
import { getApiBaseUrl, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_ID_IOS, GOOGLE_CLIENT_ID_ANDROID } from './config';

type StartupDiagnosticResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

const mask = (value?: string) => (value ? `${value.slice(0, 8)}...` : 'missing');

export async function runStartupDiagnostics(): Promise<StartupDiagnosticResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  const extra = Constants.expoConfig?.extra || {};
  const appVersion = Constants.expoConfig?.version || 'unknown';
  const appEnv = (process.env.EXPO_PUBLIC_ENV || extra.EXPO_PUBLIC_ENV || process.env.NODE_ENV || 'unknown') as string;

  let apiBaseUrl = '';
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch (error) {
    errors.push('API_BASE_URL resolution crashed');
    logger.error('[StartupDiagnostics] API resolution error:', error);
  }

  if (!apiBaseUrl) {
    errors.push('API_BASE_URL missing');
  }
  if (appEnv === 'production' && /^http:\/\//.test(apiBaseUrl)) {
    warnings.push('API_BASE_URL uses HTTP in production');
  }

  // Firebase module availability check (app may run without FCM on unsupported targets).
  let firebaseMessagingAvailable = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const messaging = require('@react-native-firebase/messaging')?.default;
    firebaseMessagingAvailable = !!messaging;
  } catch {
    firebaseMessagingAvailable = false;
    warnings.push('Firebase Messaging native module unavailable');
  }

  // Google configuration check.
  const hasGoogleClientId = Boolean(GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID_IOS || GOOGLE_CLIENT_ID_ANDROID);
  if (!hasGoogleClientId) {
    warnings.push('Google client ID is missing');
  }

  // AdMob availability check.
  const isExpoGo = Constants.appOwnership === 'expo';
  const canInitializeAds = (Platform.OS === 'ios' || Platform.OS === 'android') && !isExpoGo;

  const sentryDsn = (process.env.EXPO_PUBLIC_SENTRY_DSN || extra.EXPO_PUBLIC_SENTRY_DSN || extra.SENTRY_DSN) as
    | string
    | undefined;
  if (!sentryDsn) {
    warnings.push('Sentry DSN missing');
  }

  const iosBundleId = Constants.expoConfig?.ios?.bundleIdentifier || 'missing';
  const androidPackage = Constants.expoConfig?.android?.package || 'missing';
  const iosGoogleServicesFile = Constants.expoConfig?.ios?.googleServicesFile || 'missing';
  const androidGoogleServicesFile = Constants.expoConfig?.android?.googleServicesFile || 'missing';
  if (iosGoogleServicesFile === 'missing') {
    warnings.push('iOS GoogleService-Info.plist mapping missing');
  }
  if (androidGoogleServicesFile === 'missing') {
    warnings.push('Android google-services.json mapping missing');
  }

  logger.info('[StartupDiagnostics] Startup snapshot', {
    platform: Platform.OS,
    appVersion,
    appEnv,
    apiBaseUrl,
    bundleId: iosBundleId,
    androidPackage,
    iosGoogleServicesFile,
    androidGoogleServicesFile,
    firebaseMessagingAvailable,
    googleClientId: mask(GOOGLE_CLIENT_ID),
    googleClientIdIOS: mask(GOOGLE_CLIENT_ID_IOS),
    googleClientIdAndroid: mask(GOOGLE_CLIENT_ID_ANDROID),
    sentryDsn: mask(sentryDsn),
    canInitializeAds,
    isExpoGo,
  });

  if (warnings.length > 0) {
    logger.warn('[StartupDiagnostics] Warnings:', warnings);
  }
  if (errors.length > 0) {
    logger.error('[StartupDiagnostics] Errors:', errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  };
}
