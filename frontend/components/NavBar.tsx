import React from 'react';
import { View, Text, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import PremiumGlassCard from './ui/PremiumGlassCard';
import PremiumIconButton from './ui/PremiumIconButton';

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

// removed duplicate and broken function definition
export default function NavBar(props: NavBarProps) {
  const { theme } = useTheme();
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
  return (
    <SafeAreaView style={{
      backgroundColor: 'transparent',
      zIndex: 10,
    }} edges={["top"]}>
      <PremiumGlassCard style={{
        marginHorizontal: isTablet ? 24 : 14,
        marginTop: isAndroid ? 6 : 4,
        marginBottom: 8,
        borderRadius: 28,
      }} contentStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isTablet ? 18 : 10,
        paddingVertical: 8,
        minHeight: isTablet ? 64 : 56,
      }}>
        {shouldShowBack && (
          <PremiumIconButton
            icon="chevron-back"
            onPress={backHandler}
            accessibilityLabel="Go back"
            size={isAndroid ? 46 : 44}
            iconSize={isTablet ? 26 : 22}
            style={{ marginRight: isTablet ? 12 : 8 }}
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
          paddingHorizontal: 0,
        }}>{title}</Text>
        {rightComponent ? (
          <View style={{
            marginLeft: isTablet ? theme.spacing.md : theme.spacing.sm,
            minWidth: isAndroid ? 48 : 44,
            minHeight: isAndroid ? 48 : 44,
            justifyContent: 'center',
            alignItems: 'center',
          }}>{rightComponent}</View>
        ) : shouldShowBack ? (
          <View style={{
            width: isAndroid ? 48 : 44,
            marginLeft: isTablet ? theme.spacing.md : theme.spacing.sm,
          }} />
        ) : null}
      </PremiumGlassCard>
    </SafeAreaView>
  );
}

// ...styles removed, now handled inline
