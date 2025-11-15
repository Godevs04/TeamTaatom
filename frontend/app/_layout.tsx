import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { initializeAuth, getLastAuthError, getUserFromStorage, refreshAuthState } from '../services/auth';
import { updateExpoPushToken } from '../services/profile';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { SettingsProvider } from '../context/SettingsContext';
import { AlertProvider } from '../context/AlertContext';
import { socketService } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import ResponsiveContainer from '../components/ResponsiveContainer';
import { useWebOptimizations } from '../hooks/useWebOptimizations';


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showSessionBanner, setShowSessionBanner] = useState(true);
  const router = useRouter();
  
  // Apply web optimizations
  useWebOptimizations();

  useEffect(() => {
    let unsubFeed: (() => void) | null = null;
    let unsubProfile: (() => void) | null = null;
    let isMounted = true;
    async function setupSocket() {
      if (isAuthenticated) {
        await socketService.connect();
        // Example: subscribe to invalidate events
        const feedHandler = () => {
          // TODO: trigger feed refetch (e.g., via context or query client)
        };
        const profileHandler = (userId: string) => {
          // TODO: trigger profile refetch for userId
        };
        await socketService.subscribe('invalidate:feed', feedHandler);
        await socketService.subscribe('invalidate:profile', profileHandler);
        unsubFeed = () => socketService.unsubscribe('invalidate:feed', feedHandler);
        unsubProfile = () => socketService.unsubscribe('invalidate:profile', profileHandler);
      }
    }
    setupSocket();
    return () => {
      if (unsubFeed) unsubFeed();
      if (unsubProfile) unsubProfile();
      socketService.disconnect();
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const initialize = async () => {
      try {
        const user = await initializeAuth();
        console.log('[RootLayoutInner] initializeAuth returned:', user);
        const lastAuthError = getLastAuthError();
        
        if (user === 'network-error') {
          // Network error - keep user signed in with stored data
          setIsAuthenticated(true);
          setIsOffline(true);
          setSessionExpired(false);
          console.warn('Network error during auth initialization. User kept signed in.');
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
        console.log('[RootLayoutInner] isAuthenticated set to:', !!user);
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Fallback: check if we have stored user data
        try {
          const token = await AsyncStorage.getItem('authToken');
          const userData = await AsyncStorage.getItem('userData');
          console.log('[RootLayoutInner] Fallback - token:', !!token, 'userData:', !!userData);
          
          if (token && userData) {
            // We have both token and user data - keep signed in
            setIsAuthenticated(true);
            setIsOffline(true);
            setSessionExpired(false);
            console.log('[RootLayoutInner] Fallback: Keeping user signed in with stored data');
          } else {
            // No stored data - not authenticated
            setIsAuthenticated(false);
            setIsOffline(false);
            setSessionExpired(false);
          }
        } catch (fallbackError) {
          console.error('Fallback auth check error:', fallbackError);
          setIsAuthenticated(false);
          setIsOffline(false);
          setSessionExpired(false);
        }
      } finally {
        SplashScreen.hideAsync();
      }
    };
    initialize();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // Only navigate if we're definitely authenticated
      console.log('[Navigation] User authenticated, navigating to home');
      setTimeout(() => {
        router.replace('/home');
      }, 100);
    } else if (isAuthenticated === false && !sessionExpired) {
      // Only navigate to auth if we're definitely not authenticated and not due to session expiry
      console.log('[Navigation] User not authenticated, navigating to auth');
      router.replace('/signin');
    }
  }, [isAuthenticated, sessionExpired, router]);

  useEffect(() => {
    async function registerForPushNotifications() {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') {
          console.warn('Push notification permissions not granted');
          return;
        }
        // Get projectId from app.json extra
        const projectId =
          (Constants.expoConfig?.extra?.EXPO_PROJECT_ID as string) ||
          ((Constants.manifest as any)?.extra?.EXPO_PROJECT_ID as string);
        const tokenData = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined
        );
        const expoPushToken = tokenData.data;
        if (expoPushToken) {
          const user = await getUserFromStorage();
          if (user && user._id) {
            await updateExpoPushToken(user._id, expoPushToken);
            console.log('Expo push token registered:', expoPushToken);
          }
        }
        if (Platform.OS === 'android') {
          Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
          });
        }
      } catch (err) {
        console.error('Error registering for push notifications:', err);
      }
    }
    if (isAuthenticated) {
      registerForPushNotifications();
    }
  }, [isAuthenticated]);

  // Handle app state changes to maintain authentication
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === 'active' && isAuthenticated) {
        // App came to foreground, refresh auth state
        try {
          console.log('[AppState] App became active, refreshing auth state');
          const user = await refreshAuthState();
          if (!user) {
            console.log('[AppState] No valid user found, signing out');
            setIsAuthenticated(false);
            setSessionExpired(true);
          } else {
            console.log('[AppState] Auth state refreshed successfully');
          }
        } catch (error) {
          console.error('[AppState] Error refreshing auth state:', error);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isAuthenticated]);

  // Periodic auth state check
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        const token = await AsyncStorage.getItem('authToken');
        const userData = await AsyncStorage.getItem('userData');
        
        if (!token || !userData) {
          console.log('[PeriodicCheck] Auth data missing, signing out');
          setIsAuthenticated(false);
          setSessionExpired(true);
        }
      } catch (error) {
        console.error('[PeriodicCheck] Error:', error);
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const { theme } = useTheme();
  useEffect(() => {
    console.log('[RootLayoutInner] Render: isAuthenticated:', isAuthenticated, 'isOffline:', isOffline, 'sessionExpired:', sessionExpired);
  });

  // Debug: Log authentication state changes
  useEffect(() => {
    console.log('[AuthState] Authentication state changed:', {
      isAuthenticated,
      isOffline,
      sessionExpired
    });
  }, [isAuthenticated, isOffline, sessionExpired]);

  if (isAuthenticated === null) {
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        {!isAuthenticated
          ? <Stack.Screen name="(auth)" />
          : <Stack.Screen name="(tabs)" />
        }
      </Stack>
    </ResponsiveContainer>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SettingsProvider>
          <AlertProvider>
            <View style={styles.rootContainer}>
              <RootLayoutInner />
            </View>
          </AlertProvider>
        </SettingsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

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
