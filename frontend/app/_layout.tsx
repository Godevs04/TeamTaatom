import React, { useEffect, useState, Suspense } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeAuth, getLastAuthError, getUserFromStorage, refreshAuthState } from '../services/auth';
import { updateFCMPushToken } from '../services/profile';
import { fcmService } from '../services/fcm';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SettingsProvider } from '../context/SettingsContext';
import { AlertProvider } from '../context/AlertContext';
import { ScrollProvider } from '../context/ScrollContext';
import { socketService } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname, useSegments } from 'expo-router';
// Removed expo-notifications - using native FCM instead
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useWebOptimizations } from '../hooks/useWebOptimizations';
import { analyticsService } from '../services/analytics';
import { featureFlagsService } from '../services/featureFlags';
import { crashReportingService } from '../services/crashReporting';
import { ErrorBoundary } from '../utils/errorBoundary';
import { registerServiceWorker } from '../utils/serviceWorker';
import * as Sentry from '@sentry/react-native';
// Note: expo-av is deprecated but still needed for Audio.setAudioModeAsync
// Will migrate to expo-audio in future SDK update
import { Audio } from 'expo-av';
import * as TrackingTransparency from 'expo-tracking-transparency';
import logger from '../utils/logger';

// Validate environment variables on app startup (lazy import to avoid circular dependency)
// This will throw an error in production if secrets are exposed
if (typeof window !== 'undefined' || typeof global !== 'undefined') {
  try {
    // Lazy import to break potential circular dependency
    const { validateEnvironmentVariables } = require('../utils/envValidator');
    validateEnvironmentVariables();
  } catch (error) {
    // In production, this will prevent the app from starting
    // In development, log the error but allow the app to continue
    if (process.env.NODE_ENV === 'production') {
      throw error;
    } else {
      logger.error('Environment validation error (development mode):', error);
    }
  }
}

// Initialize Sentry with environment variables
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Enable Logs
    enableLogs: true,

    // Configure Session Replay
    replaysSessionSampleRate: process.env.EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE 
      ? parseFloat(process.env.EXPO_PUBLIC_SENTRY_REPLAY_SESSION_SAMPLE_RATE) 
      : 0.1,
    replaysOnErrorSampleRate: process.env.EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE
      ? parseFloat(process.env.EXPO_PUBLIC_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE)
      : 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

    // Environment configuration
    environment: process.env.EXPO_PUBLIC_ENV || process.env.NODE_ENV || 'development',

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
} else {
  logger.warn('Sentry DSN not found. Sentry error tracking is disabled.');
}


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showSessionBanner, setShowSessionBanner] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  
  // Apply web optimizations
  useWebOptimizations();

  // Global Audio Mode Setup (MANDATORY for iOS streaming)
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,   // 🔴 REQUIRED for iOS
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(err => logger.error('Error setting audio mode:', err));
  }, []);

  // App Tracking Transparency (ATT) - iOS 14.5+
  useEffect(() => {
    if (Platform.OS === 'ios') {
      const requestTrackingPermission = async () => {
        try {
          const { status } = await TrackingTransparency.requestTrackingPermissionsAsync();
          if (status === 'granted') {
            logger.debug('Tracking permission granted');
            // Initialize analytics or tracking services here if needed
            // Example: analyticsService.enableTracking();
          } else {
            logger.debug('Tracking permission denied');
            // App still functions normally, just without tracking
          }
        } catch (error) {
          logger.error('Error requesting tracking permission:', error);
        }
      };
      
      // Request permission after a short delay to ensure app is ready
      // Best practice: Request after user has used the app a bit (better acceptance rate)
      const timer = setTimeout(() => {
        requestTrackingPermission();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let unsubFeed: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let isMounted = true;
    async function setupSocket() {
      if (isAuthenticated) {
        // CRITICAL: Always disconnect first to ensure fresh connection with correct URL
        // This prevents reusing cached connections with wrong IP
        await socketService.disconnect();
        await socketService.connect();
        // Subscribe to invalidate events for cache invalidation
        // These handlers will trigger refetch when backend signals data changes
        // Note: Currently these are placeholders. When a global state management system
        // (e.g., React Query, Zustand, or Context API) is implemented, these handlers
        // should trigger cache invalidation and refetch operations.
        const feedHandler = () => {
          // Future: Trigger feed refetch via global state management
          // Example: queryClient.invalidateQueries(['posts']) or feedContext.refetch()
          logger.debug('Feed invalidation event received - refetch will be implemented with state management');
        };
        const profileHandler = (userId: string) => {
          // Future: Trigger profile refetch for specific userId via global state management
          // Example: queryClient.invalidateQueries(['profile', userId]) or profileContext.refetch(userId)
          logger.debug(`Profile invalidation event received for user ${userId} - refetch will be implemented with state management`);
        };
        await socketService.subscribe('invalidate:feed', feedHandler);
        await socketService.subscribe('invalidate:profile', profileHandler);
        unsubFeed = () => socketService.unsubscribe('invalidate:feed', feedHandler);
        unsubProfile = () => socketService.unsubscribe('invalidate:profile', profileHandler);
      }
    }
    setupSocket();
    
    // For web: Reconnect on page visibility change to ensure correct URL
    let visibilityHandler: (() => void) | null = null;
    if (typeof document !== 'undefined') {
      visibilityHandler = () => {
        if (document.visibilityState === 'visible' && isAuthenticated) {
          // Page became visible - reconnect to ensure correct URL
          setupSocket();
        }
      };
      document.addEventListener('visibilitychange', visibilityHandler);
    }
    
    return () => {
      if (unsubFeed) unsubFeed();
      if (unsubProfile) unsubProfile();
      socketService.disconnect();
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
      }
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const initialize = async () => {
      try {
        // Validate production environment configuration
        try {
          const { validateProductionEnvironment } = require('../utils/productionValidator');
          validateProductionEnvironment();
        } catch (validationError: any) {
          // In production, this will prevent the app from starting
          // In development, log the error but allow the app to continue
          if (process.env.NODE_ENV === 'production' || process.env.EXPO_PUBLIC_ENV === 'production') {
            logger.error('Production validation failed:', validationError);
            throw validationError;
          } else {
            logger.warn('Production validation warning (development mode):', validationError.message);
          }
        }

        // Initialize analytics, feature flags, crash reporting, service worker, and update service
        await Promise.all([
          analyticsService.initialize(),
          featureFlagsService.initialize(),
          crashReportingService.initialize(),
          registerServiceWorker(), // Register service worker for offline support (web only)
        ]);

        // Initialize update service and check for updates
        try {
          const { updateService } = require('../services/updateService');
          // Start automatic update checking (checks every 24 hours)
          updateService.startAutomaticChecking();
          // Also check immediately on app launch
          updateService.checkForUpdatesIfNeeded().catch((error: any) => {
            logger.debug('Update check failed (non-critical):', error);
          });
        } catch (error: any) {
          // Update service might not be available in development - that's okay
          logger.debug('Update service not available (development mode):', error.message);
        }

        const user = await initializeAuth();
        
        // Set user for analytics and crash reporting
        if (user && user !== 'network-error') {
          await analyticsService.setUser(user._id);
          crashReportingService.setUser(user._id, {
            username: user.username,
            email: user.email,
          });
          
          // Track user login/retention
          await analyticsService.trackRetention('app_open', {
            is_new_user: false,
          });
        }
        logger.debug('[RootLayoutInner] initializeAuth returned:', user);
        const lastAuthError = getLastAuthError();
        
        if (user === 'network-error') {
          // Network error - keep user signed in with stored data
          setIsAuthenticated(true);
          setIsOffline(true);
          setSessionExpired(false);
          logger.warn('Network error during auth initialization. User kept signed in.');
        } else if (lastAuthError === 'Session expired. Please sign in again.') {
          // Session expired - user needs to sign in again
          setIsAuthenticated(false);
          setIsOffline(false);
          setSessionExpired(true);
        } else if (user) {
          // Valid user - authenticated
          setIsAuthenticated(true);
          setIsOffline(false);
          setSessionExpired(false);
        } else {
          // No user - not authenticated
          setIsAuthenticated(false);
          setIsOffline(false);
          setSessionExpired(false);
        }
        logger.debug('[RootLayoutInner] isAuthenticated set to:', !!user);
      } catch (error) {
        logger.error('Auth initialization error:', error);
        // Fallback: check if we have stored user data
        try {
          const token = await AsyncStorage.getItem('authToken');
          const userData = await AsyncStorage.getItem('userData');
          logger.debug('[RootLayoutInner] Fallback', { hasToken: !!token, hasUserData: !!userData });
          
          if (token && userData) {
            // We have both token and user data - keep signed in
            setIsAuthenticated(true);
            setIsOffline(true);
            setSessionExpired(false);
            logger.debug('[RootLayoutInner] Fallback: Keeping user signed in with stored data');
          } else {
            // No stored data - not authenticated
            setIsAuthenticated(false);
            setIsOffline(false);
            setSessionExpired(false);
          }
        } catch (fallbackError) {
          logger.error('Fallback auth check error:', fallbackError);
          setIsAuthenticated(false);
          setIsOffline(false);
          setSessionExpired(false);
        }
      } finally {
        setIsInitializing(false);
        SplashScreen.hideAsync();
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    // Don't navigate during initialization to prevent flash to signin screen
    if (isInitializing || isAuthenticated === null) {
      return;
    }
    
    const checkOnboardingAndNavigate = async () => {
      // Get current route to avoid navigation during hot reload/refresh
      const currentPath = pathname || segments.join('/');
      const normalizedPath = currentPath.toLowerCase();
      const isOnAuthScreen = normalizedPath.includes('(auth)') || 
                             normalizedPath.includes('signin') || 
                             normalizedPath.includes('signup') || 
                             normalizedPath.includes('verifyotp') || 
                             normalizedPath.includes('forgot');
      const isOnHomeScreen = normalizedPath.includes('(tabs)/home') || 
                             normalizedPath === '/(tabs)/home' || 
                             normalizedPath === '/home';
      
      // Public routes that don't require authentication
      const isPublicRoute = segments[0] === 'policies' ||
                          segments[0] === 'support' ||
                          segments[0] === 'help' ||
                          segments[0] === 'privacy' ||
                          segments[0] === 'terms' ||
                          segments[0] === 'copyright' ||
                          normalizedPath.startsWith('/policies') ||
                          normalizedPath.startsWith('/support') ||
                          normalizedPath.startsWith('/help') ||
                          normalizedPath.startsWith('/privacy') ||
                          normalizedPath.startsWith('/terms') ||
                          normalizedPath.startsWith('/copyright');
      
      // Check if we're on any valid authenticated route (not just home)
      // Include all possible route formats and nested routes
      const isOnValidRoute = segments[0] === '(tabs)' || 
                              segments[0] === 'settings' ||
                              segments[0] === 'post' ||
                              segments[0] === 'profile' ||
                              segments[0] === 'chat' ||
                              segments[0] === 'search' ||
                              segments[0] === 'notifications' ||
                              segments[0] === 'activity' ||
                              segments[0] === 'collections' ||
                              segments[0] === 'hashtag' ||
                              segments[0] === 'user-posts' ||
                              segments[0] === 'map' ||
                              segments[0] === 'tripscore' ||
                              segments[0] === 'onboarding' ||
                              segments[0] === 'policies' ||
                              segments[0] === 'support' ||
                              segments[0] === 'help' ||
                              normalizedPath.startsWith('/post/') || 
                              normalizedPath.startsWith('/profile/') || 
                              normalizedPath.startsWith('/chat') ||
                              normalizedPath.startsWith('/search') ||
                              normalizedPath.startsWith('/notifications') ||
                              normalizedPath.startsWith('/activity') ||
                              normalizedPath.startsWith('/collections') ||
                              normalizedPath.startsWith('/settings') ||
                              normalizedPath.startsWith('/policies') ||
                              normalizedPath.startsWith('/support') ||
                              normalizedPath.startsWith('/help') ||
                              normalizedPath.startsWith('/hashtag/') ||
                              normalizedPath.startsWith('/user-posts/') ||
                              normalizedPath.startsWith('/map') ||
                              normalizedPath.startsWith('/tripscore') ||
                              normalizedPath.startsWith('/onboarding');
      
      if (isAuthenticated) {
        // If already on a valid authenticated route, don't navigate (prevents flash during refresh)
        if (isOnValidRoute && !isOnAuthScreen) {
          logger.debug('[Navigation] Already on valid route, skipping navigation', { currentPath, segments });
          return;
        }
        
        // Check if onboarding is completed
        const onboardingCompleted = await AsyncStorage.getItem('onboarding_completed');
        if (!onboardingCompleted) {
          // Redirect to onboarding if not completed - immediate navigation
          logger.debug('[Navigation] Onboarding not completed, redirecting to onboarding');
          router.replace('/onboarding/welcome');
          return;
        }
        
        // Only navigate to home if we're not already on a valid route
        if (!isOnValidRoute) {
          logger.debug('[Navigation] User authenticated, navigating to home', { currentPath, segments, isOnValidRoute });
          router.replace('/(tabs)/home');
        }
      } else if (isAuthenticated === false && !sessionExpired) {
        // If already on auth screen, don't navigate (prevents flash during refresh)
        if (isOnAuthScreen) {
          logger.debug('[Navigation] Already on auth screen, skipping navigation');
          return;
        }
        
        // Allow public routes without authentication
        if (isPublicRoute) {
          logger.debug('[Navigation] On public route, allowing access without authentication', { currentPath, segments });
          return;
        }
        
        // Only navigate to auth if we're definitely not authenticated and not due to session expiry
        // Double-check we have no stored auth data before navigating to signin
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (!token && !userData) {
          logger.debug('[Navigation] User not authenticated, navigating to auth');
          router.replace('/(auth)/signin');
        } else {
          // We have stored data but auth check failed - might be network issue
          // Don't navigate to signin, let the user stay on current screen
          logger.debug('[Navigation] Auth check failed but stored data exists, not navigating to signin');
        }
      }
    };
    
    checkOnboardingAndNavigate();
  }, [isAuthenticated, sessionExpired, isInitializing, router, pathname, segments]);

  useEffect(() => {
    // Skip push notifications on web (requires VAPID keys)
    if (Platform.OS === 'web') return;
    
    // Initialize FCM and register push token
    async function initializeFCM() {
      try {
        // Skip FCM on web platform
        if (Platform.OS === 'web') {
          return;
        }

        // Initialize FCM service
        await fcmService.initialize();

        // Get FCM token
        const fcmToken = await fcmService.getToken();
        if (fcmToken) {
          const user = await getUserFromStorage();
          if (user && user._id) {
            await updateFCMPushToken(user._id, fcmToken);
            if (process.env.NODE_ENV === 'development') {
              logger.debug('FCM token registered:', fcmToken.substring(0, 30) + '...');
            }
          }
        }

        // Set up notification opened handler
        fcmService.setupNotificationOpenedHandler((data) => {
          if (process.env.NODE_ENV === 'development') {
            logger.debug('Notification opened with data:', data);
          }
          // Handle navigation based on notification data
          // You can use router.push(data.screen) here if needed
        });
      } catch (err: any) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('Error initializing FCM:', err);
        }
        // FCM might not be available in Expo Go - that's okay
        if (err.message?.includes('Native module') || err.message?.includes('not found')) {
          logger.warn('FCM native module not available. Use a development build for full FCM support.');
        }
      }
    }

    if (isAuthenticated) {
      initializeFCM();
    }
  }, [isAuthenticated]);

  // Handle app state changes to maintain authentication (mobile only)
  useEffect(() => {
    // Skip AppState listener on web - it's not needed and can cause issues
    if (Platform.OS === 'web') return;
    
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active' && isAuthenticated) {
        // App came to foreground, refresh auth state
        try {
          if (process.env.NODE_ENV === 'development') {
            logger.debug('[AppState] App became active, refreshing auth state');
          }
          const user = await refreshAuthState();
          if (!user) {
            if (process.env.NODE_ENV === 'development') {
              logger.debug('[AppState] No valid user found, signing out');
            }
            setIsAuthenticated(false);
            setSessionExpired(true);
          } else {
            if (process.env.NODE_ENV === 'development') {
              logger.debug('[AppState] Auth state refreshed successfully');
            }
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            logger.error('[AppState] Error refreshing auth state:', error);
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated]);

  // Periodic auth state check (only for mobile, web uses cookies)
  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    const interval = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (!token || !userData) {
          if (process.env.NODE_ENV === 'development') {
            logger.debug('[PeriodicCheck] Auth data missing, signing out');
          }
          setIsAuthenticated(false);
          setSessionExpired(true);
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          logger.error('[PeriodicCheck] Error:', error);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const { theme } = useTheme();
  
  // Debug: Log authentication state changes (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug('[AuthState] Authentication state changed:', {
        isAuthenticated,
        isOffline,
        sessionExpired
      });
    }
  }, [isAuthenticated, isOffline, sessionExpired]);

  if (isAuthenticated === null || isInitializing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }] }>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <ResponsiveContainer maxWidth={Platform.OS === 'web' ? 600 : undefined}>
      {isOffline && (
        <View style={{ backgroundColor: '#ffb300', padding: 8, alignItems: 'center', zIndex: 100 }}>
          <Text style={{ color: '#222', fontWeight: 'bold' }}>You are offline. Some features may not work.</Text>
        </View>
      )}
      {sessionExpired && showSessionBanner && (
        <View style={{ backgroundColor: '#ff5252', padding: 8, alignItems: 'center', zIndex: 101, flexDirection: 'row', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: 'bold', flex: 1, textAlign: 'center' }}>Session expired. Please sign in again.</Text>
          <TouchableOpacity onPress={() => setShowSessionBanner(false)} style={{ marginLeft: 8 }}>
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <Suspense
        fallback={
          <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        }
      >
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        >
          {/* Public routes - accessible without authentication */}
          {/* Note: support, policies, privacy, terms, copyright are handled by file-based routing */}
          {/* They have _layout.tsx files or redirect files that Expo Router handles automatically */}
          <Stack.Screen name="help" options={{ presentation: 'card' }} />
          
          {/* Auth routes - always defined, access controlled by navigation guard */}
          <Stack.Screen name="(auth)" />
          
          {/* Authenticated routes - always defined, access controlled by navigation guard */}
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tripscore" options={{ presentation: 'card' }} />
          {/* Dynamic routes - use pattern matching */}
          <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="profile/[id]" options={{ presentation: 'card' }} />
          {/* Direct routes */}
          <Stack.Screen name="search" options={{ presentation: 'card' }} />
          <Stack.Screen name="followers" options={{ presentation: 'card' }} />
          <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
          {/* Nested routes with index files */}
          <Stack.Screen name="activity/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="chat/index" options={{ presentation: 'card' }} />
          {/* Collections routes */}
          <Stack.Screen name="collections/index" options={{ presentation: 'card' }} />
          <Stack.Screen name="collections/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="collections/create" options={{ presentation: 'card' }} />
          {/* Settings routes */}
          <Stack.Screen name="settings" options={{ presentation: 'card' }} />
          {/* Hashtag dynamic route */}
          <Stack.Screen name="hashtag/[hashtag]" options={{ presentation: 'card' }} />
          {/* User posts dynamic route */}
          <Stack.Screen name="user-posts/[userId]" options={{ presentation: 'card' }} />
          {/* Map routes */}
          <Stack.Screen name="map/current-location" options={{ presentation: 'card' }} />
        </Stack>
      </Suspense>
    </ResponsiveContainer>
  );
}

export default Sentry.wrap(function RootLayout() {
  return (
    <ErrorBoundary level="global" showDetails={process.env.NODE_ENV === 'development'}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <SettingsProvider>
            <AlertProvider>
              <ScrollProvider>
                <View style={styles.rootContainer}>
                  <RootLayoutInner />
                </View>
              </ScrollProvider>
            </AlertProvider>
          </SettingsProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
});

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    width: '100%',
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
      backgroundColor: '#000', // Dark background for web
    }),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor is set dynamically from theme
  },
});