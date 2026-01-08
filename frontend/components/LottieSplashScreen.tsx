import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '../context/ThemeContext';

interface LottieSplashScreenProps {
  visible?: boolean;
}

export default function LottieSplashScreen({ visible = true }: LottieSplashScreenProps) {
  const { theme } = useTheme();
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (visible && animationRef.current) {
      // Play animation when component becomes visible
      animationRef.current.play();
    }
  }, [visible]);

  if (!visible) {
    return null;
  }

  // Load the Lottie animation file
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

