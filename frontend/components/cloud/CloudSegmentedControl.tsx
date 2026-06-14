import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.90)',
        },
        isDark ? cloudDesign.shadowCard : styles.lightShadow,
        style,
      ]}
    >
      <BlurView intensity={isDark ? 40 : 24} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      {segments.map((seg) => {
        const active = value === seg.key;
        const useGradient = active && (seg.key === 'recents' || seg.key === 'locale');

        return (
          <TouchableOpacity
            key={seg.key}
            style={[
              styles.seg,
              active && !useGradient &&
                (isDark
                  ? styles.segActiveDark
                  : styles.segActiveLight),
              useGradient && { overflow: 'hidden' }
            ]}
            onPress={() => onChange(seg.key)}
            activeOpacity={0.75}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            {useGradient && (
              <LinearGradient
                colors={['#1C73B4', '#50C878']}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            )}
            <Text
              style={[
                styles.label,
                {
                  color: active
                    ? (useGradient
                      ? '#FFFFFF'
                      : (isDark ? '#FFFFFF' : '#121212'))
                    : (isDark ? theme.colors.textSecondary : '#667085'),
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
    shadowColor: 'rgba(0, 0, 0, 0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  segActiveDark: {
    backgroundColor: '#000000',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
  },
  lightShadow: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
});
