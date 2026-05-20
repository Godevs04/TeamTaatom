import React from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Line, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';

/** Full-screen mountain backdrop for Create Post — dark (moon) / light (flight path) */
export default function CloudPostMountainBackground() {
  const { mode, theme } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#06121F';

  const skyColors: [string, string, ...string[]] = isDark
    ? ['#040C14', '#06121F', '#0B1A2B', '#102236']
    : ['#C8D8E8', '#DDE8F0', '#EEF4F8', '#F8FAFC'];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={skyColors} locations={[0, 0.35, 0.7, 1]} style={StyleSheet.absoluteFill} />
      <Image
        source={require('../../assets/post_image.png')}
        style={[styles.mountainImg as ImageStyle, { opacity: isDark ? 0.55 : 0.72 }]}
        resizeMode="cover"
      />
      <LinearGradient
        colors={
          isDark
            ? ['rgba(4,12,20,0.15)', 'rgba(6,18,31,0.5)', 'rgba(6,18,31,0.88)']
            : ['rgba(255,255,255,0.05)', 'rgba(238,244,248,0.55)', 'rgba(248,250,252,0.92)']
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        {isDark ? (
          <>
            <Circle cx="42" cy="72" r="1.2" fill="rgba(255,255,255,0.5)" />
            <Circle cx="118" cy="48" r="1" fill="rgba(255,255,255,0.35)" />
            <Circle cx="210" cy="90" r="1.1" fill="rgba(255,255,255,0.4)" />
            <Circle cx="290" cy="56" r="0.9" fill="rgba(255,255,255,0.3)" />
            <Circle cx="340" cy="110" r="1" fill="rgba(255,255,255,0.35)" />
            <Defs>
              <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="rgba(173,216,255,0.35)" />
                <Stop offset="100%" stopColor="rgba(91,188,248,0)" />
              </RadialGradient>
            </Defs>
            <Circle cx="318" cy="118" r="52" fill="url(#moonGlow)" />
            <Path
              d="M318 72 C348 72 368 92 368 122 C368 152 348 172 318 172 C288 172 268 152 268 122 C268 92 288 72 318 72 Z"
              fill="rgba(217,239,255,0.12)"
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
            />
            <Path
              d="M-40 520 C60 480 140 500 220 540 C300 510 380 530 430 580 L430 844 L-40 844 Z"
              fill="rgba(6,18,31,0.75)"
            />
          </>
        ) : (
          <>
            <Path
              d="M280 88 L340 62 L348 70 L292 98 Z"
              fill="rgba(91,188,248,0.85)"
            />
            <Line
              x1="60"
              y1="100"
              x2="280"
              y2="88"
              stroke="rgba(91,188,248,0.45)"
              strokeWidth="1.5"
              strokeDasharray="6 5"
              strokeLinecap="round"
            />
            <Circle cx="60" cy="100" r="4" fill="rgba(91,188,248,0.5)" />
            <Path
              d="M-40 500 C80 470 160 490 240 530 C320 500 400 520 430 560 L430 844 L-40 844 Z"
              fill="rgba(238,244,248,0.55)"
            />
          </>
        )}
        <Path
          d="M-30 380 C50 350 130 370 200 400 C270 375 350 385 420 420 L420 520 L-30 520 Z"
          fill={isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.25)'}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  mountainImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '72%',
    top: '12%',
  },
});
