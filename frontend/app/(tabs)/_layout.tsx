import React, { useEffect, useRef } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Platform, BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { audioManager } from '../../utils/audioManager';
import logger from '../../utils/logger';
import FloatingTabBar from '../../components/ui/FloatingTabBar';

const TAB_NAMES = new Set(['home', 'shorts', 'post', 'locale', 'profile']);
const isTabPath = (p: string | null) => {
  if (!p) return false;
  const segment = p.split('/').pop() || '';
  return TAB_NAMES.has(segment);
};

export default function TabsLayout() {
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const previousPathnameRef = useRef<string | null>(null);
  const isRestoredRef = useRef(false);


  useEffect(() => {
    // Intercept hardware back button on Android
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      // 1. If we can go back in the general navigation history, do it
      if (router.canGoBack()) {
        router.back();
        return true; // Intercepted
      }

      // 2. If we are in tabs but not on the home tab, redirect to the home tab
      const isCurrentTabHome = pathname === '/(tabs)/home' || pathname === '/home' || pathname?.endsWith('/home');
      if (!isCurrentTabHome) {
        logger.debug('[TabsLayout] Intercepted back press. Redirecting to home tab.');
        router.replace('/(tabs)/home');
        return true; // Intercepted
      }

      // 3. Otherwise, let default OS behavior take place (closes the app)
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [pathname, router]);

  // Stop all audio when switching tabs (except when staying on home or shorts)
  // Use a flag to prevent multiple rapid calls
  const isStoppingAudioRef = useRef(false);
  
  useEffect(() => {
    // Skip on initial mount
    if (previousPathnameRef.current === null) {
      previousPathnameRef.current = pathname;
      return;
    }

    const previousPath = previousPathnameRef.current;
    
    // Prevent infinite loops - only process if pathname actually changed
    if (previousPath === pathname) {
      return;
    }

    // Prevent rapid-fire calls
    if (isStoppingAudioRef.current) {
      return;
    }

    previousPathnameRef.current = pathname;

    const isCurrentTab = isTabPath(pathname);
    const wasTab = isTabPath(previousPath);

    // Stop all audio whenever the user moves between tabs, regardless of which
    // tab they're leaving. Home posts (via SongPlayer) and Shorts both route
    // playback through audioManager, so a single stopAll() handles both. The
    // freeze window defeats the race where an Audio.Sound.loadAsync started on
    // the previous tab resolves AFTER navigation and would otherwise begin
    // playing in the background. Shorts itself calls unfreeze() on focus
    // return, so this won't block the next tab from starting its own playback.
    if (isCurrentTab && wasTab) {
      isStoppingAudioRef.current = true;
      audioManager.freeze(400);
      logger.debug('[TabsLayout] Stopping all audio on tab change');
      audioManager.stopAll()
        .catch((error) => {
          logger.error('[TabsLayout] Error stopping audio:', error);
        })
        .finally(() => {
          setTimeout(() => {
            isStoppingAudioRef.current = false;
          }, 100);
        });
    }
  }, [pathname]);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarAccessibilityLabel: 'Shorts tab',
        } as any}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarAccessibilityLabel: 'Create post tab',
        }}
      />
      <Tabs.Screen
        name="locale"
        options={{
          title: 'Locale',
          tabBarAccessibilityLabel: 'Locale tab',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tabs>
  );
}
