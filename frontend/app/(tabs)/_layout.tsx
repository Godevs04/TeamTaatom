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

    // Only handle tab navigation within tabs layout (not full route changes)
    // Check if both paths are within tabs - be more specific to avoid false matches
    const isCurrentTab = pathname === '/(tabs)/home' || pathname === '/(tabs)/shorts' || pathname === '/(tabs)/post' || pathname === '/(tabs)/locale' || pathname === '/(tabs)/profile' ||
                        pathname?.endsWith('/home') || pathname?.endsWith('/shorts') || pathname?.endsWith('/post') || pathname?.endsWith('/locale') || pathname?.endsWith('/profile');
    const wasTab = previousPath === '/(tabs)/home' || previousPath === '/(tabs)/shorts' || previousPath === '/(tabs)/post' || previousPath === '/(tabs)/locale' || previousPath === '/(tabs)/profile' ||
                   previousPath?.endsWith('/home') || previousPath?.endsWith('/shorts') || previousPath?.endsWith('/post') || previousPath?.endsWith('/locale') || previousPath?.endsWith('/profile');
    
    // Only handle tab-to-tab navigation here
    if (isCurrentTab && wasTab) {
      const isHomeOrShorts = pathname === '/(tabs)/home' || pathname === '/(tabs)/shorts' || pathname?.endsWith('/home') || pathname?.endsWith('/shorts');
      const wasHomeOrShorts = previousPath === '/(tabs)/home' || previousPath === '/(tabs)/shorts' || previousPath?.endsWith('/home') || previousPath?.endsWith('/shorts');
      
      // If leaving home or shorts, stop audio
      if (wasHomeOrShorts && !isHomeOrShorts) {
        isStoppingAudioRef.current = true;
        logger.debug('[TabsLayout] Stopping all audio - navigating away from home/shorts');
        audioManager.stopAll()
          .catch((error) => {
            logger.error('[TabsLayout] Error stopping audio:', error);
          })
          .finally(() => {
            // Reset flag after a short delay to allow for navigation
            setTimeout(() => {
              isStoppingAudioRef.current = false;
            }, 100);
          });
      }
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
        tabBarStyle: tabBarStyle as any,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: isTablet ? (isWeb ? 14 : 13) : (isWeb ? 12 : 11),
          fontFamily: isWeb ? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' : (isIOS ? 'System' : 'Roboto'),
          fontWeight: '600',
          letterSpacing: isIOS ? 0.2 : 0,
        },
        tabBarIconStyle: {
          marginBottom: isWeb ? 0 : 4,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="shorts"
        options={{
          title: 'Shorts',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="locale"
        options={{
          title: 'Locale',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="location" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
