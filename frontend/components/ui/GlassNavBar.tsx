import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getFontFamily } from '../../constants/typography';
import Animated, { SlideInUp } from 'react-native-reanimated';

export interface GlassNavBarProps extends ViewProps {
  title?: string;
  showBack?: boolean;
  rightComponent?: React.ReactNode;
}

export const GlassNavBar = ({ title, showBack = true, rightComponent, style, ...props }: GlassNavBarProps) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Animated.View 
      entering={SlideInUp.duration(300)}
      style={[
        styles.container, 
        { 
          paddingTop: insets.top,
          borderBottomWidth: theme.glass.border.width,
          borderBottomColor: theme.glass.border.color,
          backgroundColor: isDark ? theme.colors.frostTintMedium : theme.colors.glassBackground,
        },
        style
      ]}
      {...props}
    >
      <BlurView intensity={theme.glass.blur.medium} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>
        {showBack ? (
          <TouchableOpacity onPress={() => router.back()} style={styles.leftBtn}>
            <Ionicons name="chevron-back-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        ) : <View style={styles.leftBtn} />}
        
        {title && (
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: getFontFamily('semibold') }]}>
            {title}
          </Text>
        )}
        
        <View style={styles.rightBtn}>
          {rightComponent}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    zIndex: 100,
  },
  content: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 17,
  },
  leftBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rightBtn: {
    width: 40,
    height: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  }
});
