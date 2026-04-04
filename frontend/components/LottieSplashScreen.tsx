import React from 'react';
import { View, StyleSheet, Platform, ActivityIndicator, Image } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// TODO: Lottie animation removed - using default icon instead
// Removed lottie-react-native dependency usage

interface LottieSplashScreenProps {
  visible?: boolean;
}

export default function LottieSplashScreen({ visible = true }: LottieSplashScreenProps) {
  const { theme } = useTheme();

  if (!visible) {
    return null;
  }

  // Use default icon image instead of Lottie animation
  // Try to load icon.png, fallback to ActivityIndicator if not available
  let iconSource;
  try {
    iconSource = require('../assets/icon.png');
  } catch (error) {
    // Icon not found, will use ActivityIndicator
    iconSource = null;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background || '#000000' }]}>
      {iconSource ? (
        <Image
          source={iconSource}
          style={styles.icon}
          resizeMode="contain"
        />
      ) : (
        <ActivityIndicator size="large" color={theme.colors.primary || '#007AFF'} />
      )}
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
  icon: {
    width: 120,
    height: 120,
  },
});

