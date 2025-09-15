import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { initializeAuth, getLastAuthError, getUserFromStorage } from '../services/auth';
import { updateExpoPushToken } from '../services/profile';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { socketService } from '../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';


// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [showSessionBanner, setShowSessionBanner] = useState(true);
  const router = useRouter();

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
          setIsAuthenticated(true);
          setIsOffline(true);
          setSessionExpired(false);
          console.warn('Network error during auth initialization. User kept signed in.');
        } else if (lastAuthError === 'Session expired. Please sign in again.') {
          setIsAuthenticated(false);
          setIsOffline(false);
          setSessionExpired(true);
        } else {
          setIsAuthenticated(!!user);
          setIsOffline(false);
          setSessionExpired(false);
        }
        console.log('[RootLayoutInner] isAuthenticated set to:', !!user);
      } catch (error) {
        console.error('Auth initialization error:', error);
        try {
          const token = await AsyncStorage.getItem('authToken');
          console.log('[RootLayoutInner] Fallback token in storage:', token);
          if (token) {
            setIsAuthenticated(true);
            setIsOffline(true);
            setSessionExpired(false);
          } else {
            setIsAuthenticated(false);
            setIsOffline(false);
            setSessionExpired(false);
          }
        } catch {
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
      // Force navigation to home tab after auth
      // setTimeout(() => {
        router.replace('/home');
      // }, 100);
    }
  }, [isAuthenticated, router]);

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

  const { theme } = useTheme();
  useEffect(() => {
    console.log('[RootLayoutInner] Render: isAuthenticated:', isAuthenticated, 'isOffline:', isOffline, 'sessionExpired:', sessionExpired);
  });

  if (isAuthenticated === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }] }>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
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
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor is set dynamically from theme
  },
});
