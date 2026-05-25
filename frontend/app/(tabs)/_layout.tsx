import React, { useEffect, useRef } from 'react';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions, StyleSheet, View, BackHandler, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const { isDark } = useTheme();

  if (!focused) {
    return <Ionicons name={name} size={22} color={color} />;
  }

  const gradientColors = (isDark ? ['#FFFFFF', '#8A9AA5'] : ['#121212', '#4A6274']) as [string, string];
  const iconColor = isDark ? '#121212' : '#FFFFFF';

  return (
    <View style={styles.activeIconShell}>
      <LinearGradient
        colors={gradientColors}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <Ionicons name={name} size={20} color={iconColor} />
    </View>
  );
}

export default function TabsLayout() {
  const { theme, isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const previousPathnameRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const isRestoredRef = useRef(false);

  // Restore last active tab on mount
  useEffect(() => {
    const restoreLastTab = async () => {
      if (isRestoredRef.current) return;
      isRestoredRef.current = true;
      try {
        const lastTab = await AsyncStorage.getItem('lastActiveTabPath');
        if (lastTab && isTabPath(lastTab) && pathname !== lastTab) {
          // Extract tab segment to navigate cleanly
          const tabSegment = lastTab.split('/').pop() || '';
          logger.debug(`[TabsLayout] Restoring last active tab segment: ${tabSegment} from path ${lastTab}`);
          router.replace(`/(tabs)/${tabSegment}` as any);
        }
      } catch (err) {
        logger.error('[TabsLayout] Failed to restore last active tab:', err);
      }
    };

    restoreLastTab();
  }, [router, pathname]);

  // Persist current tab pathname whenever it changes
  useEffect(() => {
    if (pathname && isTabPath(pathname)) {
      AsyncStorage.setItem('lastActiveTabPath', pathname).catch((err) => {
        logger.error('[TabsLayout] Failed to save active tab path:', err);
      });
    }
  }, [pathname]);

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

  const isPostScreen = pathname === '/post' || pathname === '/(tabs)/post' || pathname?.endsWith('/post');

  // Fixed Tab Bar covering bottom entirely
  const tabBarStyle = {
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    elevation: isPostScreen ? 0 : 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: isPostScreen ? 0 : (isDark ? 0.3 : 0.04),
    shadowRadius: 8,
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: isPostScreen ? 0 : 60 + insets.bottom,
    paddingBottom: insets.bottom,
    paddingTop: 8,
    overflow: 'hidden' as const,
    zIndex: isPostScreen ? -1 : 1000,
    display: isPostScreen ? 'none' as const : 'flex' as const,
    // Always visible - no transform/animation
    transform: [{ translateY: 0 }],
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarShowLabel: false,
        tabBarStyle: tabBarStyle as any,
        tabBarBackground: () => (
          <LinearGradient
            colors={isDark ? ['#1A1C23', '#0F1015'] : ['#FFFFFF', '#F5F7FA']}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
          />
        ),
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarIconStyle: {
          marginBottom: 0,
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
            <CloudTabIcon name={focused ? 'play-circle' : 'play-circle-outline'} color={color} focused={focused} />
          ),
        } as any}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Create post tab',
          tabBarButton: (props) => {
            const { ref, style, children, ...rest } = props as any;
            return (
              <Pressable
                {...rest}
                style={[style, { backgroundColor: 'transparent' }]}
              >
                {children}
              </Pressable>
            );
          },
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.centerTab,
                {
                  backgroundColor: focused
                    ? (isDark ? '#FFFFFF' : '#121212')
                    : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                  borderColor: focused
                    ? (isDark ? '#FFFFFF' : '#121212')
                    : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'),
                  shadowColor: '#000000',
                  elevation: focused ? 6 : 0,
                  shadowOpacity: focused ? 0.15 : 0,
                },
              ]}
            >
              <Ionicons
                name="add"
                size={28}
                color={focused
                  ? (isDark ? '#121212' : '#FFFFFF')
                  : (isDark ? '#FFFFFF' : '#121212')}
              />
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
            <CloudTabIcon name={focused ? 'location' : 'location-outline'} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
          tabBarIcon: ({ color, focused }) => (
            <CloudTabIcon name={focused ? 'person' : 'person-outline'} color={color} focused={focused} />
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
