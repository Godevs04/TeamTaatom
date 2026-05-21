import React from 'react';
import { View, Text, Platform, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
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
    <SafeAreaView 
      style={{
        backgroundColor: theme.colors.background,
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 8,
        zIndex: 10,
      }} 
      edges={["top"]}
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
        backgroundColor: theme.colors.background,
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
      </View>
    </SafeAreaView>
  );
}