import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { initializeAuth } from '../services/auth';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { socketService } from '../services/socket';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

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
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsAuthenticated(false);
      } finally {
        // Hide the splash screen after auth state is determined
        SplashScreen.hideAsync();
      }
    };

    initialize();
  }, []);

  const { theme } = useTheme();
  if (isAuthenticated === null) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }] }>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="(auth)" />
        </>
      ) : (
        <Stack.Screen name="(tabs)" />
      )}
    </Stack>
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
