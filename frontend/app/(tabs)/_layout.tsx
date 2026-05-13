import React, { useEffect, useRef } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { audioManager } from '../../utils/audioManager';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isIOS = Platform.OS === 'ios';

const TAB_NAMES = new Set(['home', 'shorts', 'post', 'locale', 'profile']);
const isTabPath = (p: string | null) => {
  if (!p) return false;
  const segment = p.split('/').pop() || '';
  return TAB_NAMES.has(segment);
};

export default function TabsLayout() {
  const { theme } = useTheme();
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);

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

  // Tab bar style - always visible (constant, no disappearing while scrolling)
  const tabBarStyle = {
    backgroundColor: theme.colors.surface,
    borderTopColor: theme.colors.border,
    borderTopWidth: 1,
    paddingBottom: isWeb ? 12 : 8,
    paddingTop: isWeb ? 12 : 8,
    height: isWeb ? 70 : 88,
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    // Always visible - no transform/animation
    transform: [{ translateY: 0 }],
    ...(isWeb && {
      maxWidth: 600,
      alignSelf: 'center' as const,
      width: '100%',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    }),
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarStyle: tabBarStyle as any,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: isTablet ? (isWeb ? 11 : 10) : (isWeb ? 10 : 10),
          fontFamily: isWeb ? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' : (isIOS ? 'System' : 'Roboto'),
          fontWeight: '600',
          letterSpacing: 0.1,
          marginTop: -2,
        },
        tabBarIconStyle: {
          marginBottom: isWeb ? 0 : 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarAccessibilityLabel: 'Shorts tab',
          // unmountOnBlur frees all video decoders on tab switch and ensures
          // a clean remount (fresh from top) when the user returns.
          unmountOnBlur: true,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'play-circle' : 'play-circle-outline'} size={22} color={color} />
          ),
        } as any}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarAccessibilityLabel: 'Create post tab',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="locale"
        options={{
          title: 'Locale',
          tabBarAccessibilityLabel: 'Locale tab',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'location' : 'location-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
