import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/** Organized sky + soft clouds + light rain — global screen backdrop */
export default function CloudRainyBackground() {
  const { mode, theme } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  const colors: [string, string, ...string[]] = isDark
    ? ['#000000', '#000000', '#000000', '#000000']
    : ['#8EC8F0', '#B8DFF9', '#D9EFFF', '#F4FAFF'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={colors} locations={isDark ? [0, 0.35, 0.7, 1] : [0, 0.3, 0.65, 1]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <Path
          d="M-30 118 C40 78 110 88 168 118 C228 72 310 78 360 128 C400 118 440 138 450 178 L450 240 L-30 240 Z"
          fill={isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.42)'}
        />
        <Path
          d="M-20 200 C50 168 120 182 178 218 C248 178 322 188 372 232 C410 224 440 248 450 278 L450 340 L-20 340 Z"
          fill={isDark ? 'rgba(217,239,255,0.05)' : 'rgba(255,255,255,0.35)'}
        />
        <Circle cx="72" cy="96" r="52" fill={isDark ? 'rgba(91,188,248,0.08)' : 'rgba(255,255,255,0.38)'} />
        <Circle cx="318" cy="164" r="64" fill={isDark ? 'rgba(91,188,248,0.06)' : 'rgba(255,255,255,0.32)'} />
        <Path
          d="M0 520 C80 488 150 508 210 548 C280 512 350 522 390 568 L390 844 L0 844 Z"
          fill={isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.28)'}
        />
        {RAIN_LINES.map((line, i) => (
          <Line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={isDark ? 'rgba(173,216,255,0.14)' : 'rgba(91,188,248,0.22)'}
            strokeWidth={1.2}
            strokeLinecap="round"
          />
        ))}
      </Svg>
    </View>
  );
}

const RAIN_LINES = [
  { x1: 40, y1: 120, x2: 36, y2: 148 },
  { x1: 88, y1: 100, x2: 84, y2: 132 },
  { x1: 130, y1: 140, x2: 126, y2: 172 },
  { x1: 175, y1: 95, x2: 171, y2: 128 },
  { x1: 220, y1: 125, x2: 216, y2: 158 },
  { x1: 265, y1: 108, x2: 261, y2: 142 },
  { x1: 310, y1: 135, x2: 306, y2: 168 },
  { x1: 350, y1: 115, x2: 346, y2: 150 },
  { x1: 60, y1: 200, x2: 56, y2: 232 },
  { x1: 145, y1: 190, x2: 141, y2: 222 },
  { x1: 235, y1: 205, x2: 231, y2: 238 },
  { x1: 320, y1: 195, x2: 316, y2: 228 },
];
