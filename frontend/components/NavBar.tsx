import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { theme } from '../constants/theme';

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
  // Use elegant black font for title in light theme, else use primary color
  const titleColor = theme.colors.background === '#F5F7FA' ? '#181A20' : theme.colors.primary;
  return (
    <SafeAreaView style={{
      backgroundColor: theme.colors.surface,
      zIndex: 10,
      shadowColor: theme.colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 6,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    }} edges={["top"]}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
        paddingTop: isIOS ? (isTablet ? 12 : 10) : (isTablet ? 18 : 16),
        paddingBottom: isTablet ? theme.spacing.lg : 16,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border,
        minHeight: isTablet ? 64 : 56,
      }}>
        {shouldShowBack && (
          <TouchableOpacity 
            onPress={backHandler} 
            style={{ 
              marginRight: isTablet ? theme.spacing.md : theme.spacing.sm,
              // Minimum 44x44 touch target for iOS, 48x48 for Android
              minWidth: isAndroid ? 48 : 44,
              minHeight: isAndroid ? 48 : 44,
              justifyContent: 'center',
              alignItems: 'center',
              padding: isTablet ? theme.spacing.sm : 8,
              borderRadius: theme.borderRadius.md,
              ...(isWeb && {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              } as any),
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="chevron-back" 
              size={isTablet ? 28 : 24} 
              color={theme.colors.text} 
            />
          </TouchableOpacity>
        )}
        <Text style={{
          flex: 1,
          fontSize: isTablet ? theme.typography.h2.fontSize : 22,
          fontFamily: isWeb ? 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' : (isIOS ? 'System' : 'Roboto'),
          fontWeight: 'bold',
          color: titleColor,
          textAlign: 'center',
          letterSpacing: isIOS ? 0.5 : 0.3,
          paddingHorizontal: shouldShowBack ? (isTablet ? theme.spacing.md : theme.spacing.sm) : 0,
        }}>{title}</Text>
        {rightComponent && (
          <View style={{ 
            marginLeft: isTablet ? theme.spacing.md : theme.spacing.sm,
            minWidth: isAndroid ? 48 : 44,
            minHeight: isAndroid ? 48 : 44,
            justifyContent: 'center',
            alignItems: 'center',
          }}>{rightComponent}</View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ...styles removed, now handled inline
