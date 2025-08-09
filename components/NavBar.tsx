import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface NavBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  rightComponent?: React.ReactNode;
}

// removed duplicate and broken function definition
export default function NavBar(props: NavBarProps) {
  const { theme } = useTheme();
  const { title, showBack = false, onBack, rightComponent } = props;
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
        paddingHorizontal: theme.spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 10 : 16,
        paddingBottom: 16,
        backgroundColor: theme.colors.surface,
        borderBottomWidth: 0.5,
        borderBottomColor: theme.colors.border,
      }}>
        {showBack && (
          <TouchableOpacity onPress={onBack} style={{ marginRight: theme.spacing.sm, padding: 4 }}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        )}
        <Text style={{
          flex: 1,
          fontSize: 22,
          fontWeight: 'bold',
          color: theme.colors.primary,
          textAlign: 'center',
          letterSpacing: 0.5,
        }}>{title}</Text>
        {rightComponent && (
          <View style={{ marginLeft: theme.spacing.sm }}>{rightComponent}</View>
        )}
      </View>
    </SafeAreaView>
  );
}

// ...styles removed, now handled inline
