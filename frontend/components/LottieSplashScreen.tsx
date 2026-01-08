import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Platform-specific import to avoid web import issues
let LottieView: any = null;
if (Platform.OS !== 'web') {
  try {
    LottieView = require('lottie-react-native').default;
  } catch (error) {
    // Fallback if lottie-react-native is not available
    console.warn('lottie-react-native not available:', error);
  }
}

interface LottieSplashScreenProps {
  visible?: boolean;
}

export default function LottieSplashScreen({ visible = true }: LottieSplashScreenProps) {
  const { theme } = useTheme();
  const animationRef = useRef<any>(null);

  useEffect(() => {
    if (visible && animationRef.current && LottieView && Platform.OS !== 'web') {
      // Play animation when component becomes visible (native only)
      animationRef.current.play();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  // Web fallback: Use ActivityIndicator instead of Lottie
  if (Platform.OS === 'web' || !LottieView) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background || '#000000' }]}>
        <ActivityIndicator size="large" color={theme.colors.primary || '#007AFF'} />
      </View>
    );
  }

  // Native platforms: Use Lottie animation
  const animationSource = require('../assets/splash.json');

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background || '#000000' }]}>
      <LottieView
        ref={animationRef}
        source={animationSource}
        autoPlay={true}
        loop={true}
        style={styles.animation}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  animation: {
    width: '100%',
    height: '100%',
  },
});

