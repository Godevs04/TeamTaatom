import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { cloudDesign } from '../../constants/cloudDesign';

export interface PremiumSegmentTab<T extends string> {
  key: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface PremiumSegmentedTabsProps<T extends string> {
  tabs: PremiumSegmentTab<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export default function PremiumSegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  style,
}: PremiumSegmentedTabsProps<T>) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(91,188,248,0.12)',
        },
        cloudDesign.shadowCard,
        style,
      ]}
    >
      <BlurView intensity={isDark ? 40 : 24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      <View style={styles.content}>
        {tabs.map((tab) => {
          const active = value === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, active && (isDark ? styles.tabActiveDark : styles.tabActiveLight)]}
              activeOpacity={0.75}
              onPress={() => onChange(tab.key)}
            >
              {active && !isDark ? (
                <LinearGradient
                  colors={theme.colors.gradient.button as [string, string]}
                  style={StyleSheet.absoluteFillObject}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              ) : null}
              {active && isDark ? (
                <View style={[StyleSheet.absoluteFillObject, styles.tabActiveDarkFill]} />
              ) : null}
              {tab.icon ? (
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={active ? '#FFFFFF' : theme.colors.textSecondary}
                />
              ) : null}
              <Text
                style={[
                  styles.label,
                  { color: active ? '#FFFFFF' : theme.colors.textSecondary },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    overflow: 'hidden',
  },
  tabActiveLight: {},
  tabActiveDark: {},
  tabActiveDarkFill: {
    backgroundColor: 'rgba(91, 188, 248, 0.42)',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
