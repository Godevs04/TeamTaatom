import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import Svg, { Path, Circle } from 'react-native-svg';

interface PremiumScreenProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export default function PremiumScreen({
  children,
  edges = ['top'],
  style,
  contentStyle,
}: PremiumScreenProps) {
  const { theme, isDark } = useTheme();
  const gradient = (theme.premium?.screenGradient || theme.colors.appBackgroundGradient) as [string, string, string];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }, style]} edges={edges}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
        <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none">
          <Path
            d="M-44 132 C18 88 94 94 142 130 C192 84 278 86 330 138 C372 132 418 150 438 190 L438 274 L-44 274 Z"
            fill={isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.46)'}
          />
          <Path
            d="M-36 260 C44 226 106 240 158 282 C220 238 304 246 354 294 C400 290 430 314 442 344 L442 438 L-36 438 Z"
            fill={isDark ? 'rgba(217,239,255,0.10)' : 'rgba(237,247,255,0.72)'}
          />
          <Circle cx="56" cy="108" r="44" fill={isDark ? 'rgba(91,188,248,0.13)' : 'rgba(255,255,255,0.38)'} />
          <Circle cx="332" cy="222" r="54" fill={isDark ? 'rgba(67,184,156,0.10)' : 'rgba(255,255,255,0.34)'} />
          <Path
            d="M18 706 C90 668 150 692 196 724 C254 684 334 696 388 742 L388 844 L18 844 Z"
            fill={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.50)'}
          />
        </Svg>
      </View>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
});
