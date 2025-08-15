import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { isAuthenticated as checkAuthStatus, getCurrentUser } from '../services/auth';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

function RootLayoutInner() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const authenticated = await checkAuthStatus();
        if (authenticated) {
          // Verify the user data is still valid
          const user = await getCurrentUser();
          setIsAuthenticated(!!user);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setIsAuthenticated(false);
      } finally {
        // Hide the splash screen after auth state is determined
        SplashScreen.hideAsync();
      }
    };

    initializeAuth();
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
