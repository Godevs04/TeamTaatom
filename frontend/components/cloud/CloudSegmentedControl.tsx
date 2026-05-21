import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

export interface CloudSegment<T extends string> {
  key: T;
  label: string;
}

interface CloudSegmentedControlProps<T extends string> {
  segments: CloudSegment<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

export default function CloudSegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  style,
}: CloudSegmentedControlProps<T>) {
  const { mode, theme } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.45)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(91,188,248,0.12)',
        },
        cloudDesign.shadowCard,
        style,
      ]}
    >
      <BlurView intensity={isDark ? 40 : 24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      {segments.map((seg) => {
        const active = value === seg.key;
        return (
          <TouchableOpacity
            key={seg.key}
            style={[
              styles.seg,
              active &&
                (isDark
                  ? styles.segActiveDark
                  : styles.segActiveLight),
            ]}
            onPress={() => onChange(seg.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? isDark
                      ? '#FFFFFF'
                      : cloudDesign.blueDeep
                    : isDark
                      ? theme.colors.textSecondary
                      : cloudDesign.textMuted,
                },
              ]}
            >
              {seg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: cloudDesign.radius.pill,
    padding: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seg: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: cloudDesign.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segActiveLight: {
    backgroundColor: '#FFFFFF',
    shadowColor: 'rgba(91, 188, 248, 0.2)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  segActiveDark: {
    backgroundColor: 'rgba(91, 188, 248, 0.38)',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
  },
});
