import React from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
          backgroundColor: 'transparent',
          borderBottomWidth: 1.5,
          borderBottomColor: theme.colors.border,
        },
        style,
      ]}
    >
      <View style={styles.content}>
        {tabs.map((tab) => {
          const active = value === tab.key;
          const iconColor = active 
            ? (isDark ? '#FFFFFF' : '#000000') 
            : theme.colors.textPassive;
          const textColor = active 
            ? (isDark ? '#FFFFFF' : '#000000') 
            : theme.colors.textPassive;

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              activeOpacity={0.75}
              onPress={() => onChange(tab.key)}
            >
              {tab.icon ? (
                <Ionicons
                  name={tab.icon}
                  size={15}
                  color={iconColor}
                />
              ) : null}
              <Text
                style={[
                  styles.label,
                  { color: textColor },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {active ? (
                <View style={styles.underline} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    paddingBottom: 0,
    gap: 4,
    zIndex: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    position: 'relative',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  underline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 3,
    backgroundColor: '#50C878', // Emerald Green 3px solid underline
    borderRadius: 1.5,
  },
});
