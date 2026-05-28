import React from 'react';
import { View, Text, Platform, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import PremiumIconButton from './ui/PremiumIconButton';
import { BlurView } from 'expo-blur';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

interface NavBarProps {
  title: string;
  showBack?: boolean;
  showBackButton?: boolean;
  onBack?: () => void;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
}

export default function NavBar(props: NavBarProps) {
  const { theme, isDark } = useTheme();
  const { 
    title, 
    showBack = false, 
    showBackButton = false, 
    onBack, 
    onBackPress, 
    rightComponent 
  } = props;
  
  const shouldShowBack = showBack || showBackButton;
  const backHandler = onBack || onBackPress;
  const titleColor = theme.colors.text;
  const insets = useSafeAreaInsets();

  return (
    <View 
      style={{
        paddingTop: insets.top,
        backgroundColor: 'transparent',
        zIndex: 10,
        position: 'relative',
      }}
    >
      <View style={{
        marginHorizontal: isTablet ? 24 : 14,
        marginTop: isAndroid ? 6 : 4,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isTablet ? 18 : 10,
        paddingVertical: 8,
        minHeight: isTablet ? 64 : 56,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDark ? 0.3 : 0.1,
        shadowRadius: 10,
        elevation: 4,
        overflow: 'hidden',
      }}>
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        {shouldShowBack && (
          <PremiumIconButton
            icon="chevron-back"
            onPress={backHandler}
            accessibilityLabel="Go back"
            size={isAndroid ? 46 : 44}
            iconSize={isTablet ? 26 : 22}
            color={isDark ? '#38BDF8' : '#1C73B4'}
            style={{ marginRight: isTablet ? 12 : 8, zIndex: 1 }}
          />
        )}
        <Text
          accessibilityRole="header"
          accessibilityLabel={title}
          style={{
            flex: 1,
            fontSize: isTablet ? theme.typography.h2.fontSize : 22,
            fontFamily: isWeb ? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' : (isIOS ? 'System' : 'Roboto'),
            fontWeight: 'bold',
            color: titleColor,
            textAlign: 'center',
            letterSpacing: isIOS ? 0.5 : 0.3,
            zIndex: 1,
          }}>{title}</Text>
        {rightComponent ? (
          <View style={{
            marginLeft: isTablet ? theme.spacing.md : theme.spacing.sm,
            minWidth: isAndroid ? 48 : 44,
            minHeight: isAndroid ? 48 : 44,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
          }}>{rightComponent}</View>
        ) : shouldShowBack ? (
          <View style={{
            width: isAndroid ? 48 : 44,
            marginLeft: isTablet ? theme.spacing.md : theme.spacing.sm,
            zIndex: 1,
          }} />
        ) : null}
      </View>
    </View>
  );
}