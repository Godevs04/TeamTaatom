import React from 'react';
import { View, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { GlassInput } from './GlassInput';

export interface GlassSearchBarProps extends TextInputProps {
  onSearch?: (text: string) => void;
}

export const GlassSearchBar = ({ onSearch, onChangeText, style, ...props }: GlassSearchBarProps) => {
  const { theme } = useTheme();

  const handleChangeText = (text: string) => {
    onChangeText?.(text);
    onSearch?.(text);
  };

  return (
    <View style={styles.wrapper}>
      <GlassInput
        placeholder="Search..."
        onChangeText={handleChangeText}
        containerStyle={[styles.inputContainer, style]}
        {...props}
      />
      <View style={styles.iconContainer} pointerEvents="none">
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputContainer: {
    marginBottom: 0, // Override default GlassInput margin
  },
  iconContainer: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
