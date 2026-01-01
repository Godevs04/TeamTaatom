import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');

interface ResponsiveContainerProps {
  children: React.ReactNode;
  maxWidth?: number;
  style?: any;
}

/**
 * Responsive container that limits width on web/tablet and centers content
 * On mobile, it takes full width
 * On web/tablet, it limits to maxWidth and centers the content
 */
export default function ResponsiveContainer({ 
  children, 
  maxWidth = 600,
  style 
}: ResponsiveContainerProps) {
  const isWeb = Platform.OS === 'web';
  const isTablet = screenWidth >= 768;
  
  // On web/tablet, limit width and center
  if (isWeb || isTablet) {
    return (
      <View style={[styles.container, { maxWidth }, style]}>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    );
  }
  
  // On mobile, full width
  return <View style={[styles.mobileContainer, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  content: {
    flex: 1,
    width: '100%',
  },
  mobileContainer: {
    flex: 1,
    width: '100%',
  },
});

