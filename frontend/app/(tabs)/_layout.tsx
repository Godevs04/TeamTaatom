import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Dimensions, Animated } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useScroll } from '../../context/ScrollContext';

const { width: screenWidth } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = screenWidth >= 768;
const isIOS = Platform.OS === 'ios';

export default function TabsLayout() {
  const { theme } = useTheme();
  const { isScrollingUp } = useScroll();
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isScrollingUp ? 100 : 0,
      duration: 300,
      useNativeDriver: false, // Must be false for transform on layout properties
    }).start();
  }, [isScrollingUp, translateY]);

  const animatedTabBarStyle = {
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
    transform: [{ translateY }],
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
        tabBarStyle: animatedTabBarStyle as any,
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
