import React, { useEffect, useRef } from 'react';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { audioManager } from '../../utils/audioManager';
import logger from '../../utils/logger';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

function CloudTabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  if (!focused) {
    return <Ionicons name={name} size={22} color={color} />;
  }

  return (
    <View style={styles.activeIconShell}>
      <LinearGradient
        colors={['#5BBCF8', '#2B7FD4']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Ionicons name={name} size={20} color="#FFFFFF" />
    </View>
  );
}

export default function TabsLayout() {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const previousPathnameRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();

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

  // Tab bar — solid dock (no blur) so content never shows through
  const tabBarStyle = {
    backgroundColor: theme.colors.floatingDock,
    borderTopWidth: 1,
    borderTopColor: theme.colors.glassBorder,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: isWeb ? 70 : (isIOS ? (insets.bottom > 0 ? 56 + insets.bottom : 64) : 68),
    borderRadius: 0,
    paddingBottom: isWeb ? 10 : (isIOS ? (insets.bottom > 0 ? insets.bottom : 12) : 12),
    paddingTop: 10,
    overflow: 'hidden' as const,
    zIndex: 1000,
    // Always visible - no transform/animation
    transform: [{ translateY: 0 }],
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarStyle: tabBarStyle as any,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.floatingDock }]} />
        ),
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
            <CloudTabIcon name={focused ? 'home' : 'home-outline'} color={color} focused={focused} />
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
            <CloudTabIcon name={focused ? 'sparkles' : 'play-circle-outline'} color={color} focused={focused} />
          ),
        } as any}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Create post tab',
          tabBarIcon: () => (
            <View
              style={[
                styles.centerTab,
                {
                  backgroundColor: theme.colors.primary,
                  shadowColor: '#000000',
                },
              ]}
            >
              <Ionicons name="add" size={28} color="#FFFFFF" />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="locale"
        options={{
          title: 'Locale',
          tabBarAccessibilityLabel: 'Locale tab',
          tabBarIcon: ({ color, focused }) => (
            <CloudTabIcon name={focused ? 'map' : 'location-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color, focused }) => (
            <CloudTabIcon name={focused ? 'trophy' : 'person-outline'} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerTab: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  activeIconShell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: -1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
});
