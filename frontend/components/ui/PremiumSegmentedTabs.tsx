import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PremiumGlassCard from './PremiumGlassCard';
import { useTheme } from '../../context/ThemeContext';

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
  const { theme } = useTheme();

  return (
    <PremiumGlassCard style={[styles.container, style]} contentStyle={styles.content}>
      {tabs.map((tab) => {
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              active && {
                backgroundColor: theme.colors.primary,
                shadowColor: theme.colors.glowBlue || theme.colors.primary,
              },
            ]}
            activeOpacity={0.75}
            onPress={() => onChange(tab.key)}
          >
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
    </PremiumGlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
  },
  content: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
