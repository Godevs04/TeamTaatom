import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

interface CloudSearchDockProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  onFilterPress?: () => void;
  filterBadgeCount?: number;
  style?: StyleProp<ViewStyle>;
  inputProps?: Partial<TextInputProps>;
}

export default function CloudSearchDock({
  value,
  onChangeText,
  placeholder = 'Search',
  onSubmit,
  onFilterPress,
  filterBadgeCount = 0,
  style,
  inputProps,
}: CloudSearchDockProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  return (
    <View
      style={[
        styles.plush,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)',
        },
        cloudDesign.shadowCard,
        style,
      ]}
    >
      <View
        style={[
          styles.searchRow,
          {
            backgroundColor: isDark ? 'rgba(18, 34, 54, 0.72)' : 'rgba(255,255,255,0.9)',
            borderColor: isDark ? theme.colors.glassBorder : 'rgba(91,188,248,0.08)',
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={isDark ? theme.colors.textSecondary : cloudDesign.textMuted} />
        <TextInput
          style={[styles.input, { color: theme.colors.text }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? theme.colors.textSecondary : cloudDesign.textMuted}
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          onSubmitEditing={onSubmit}
          {...inputProps}
        />
        {value.length > 0 ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={12}>
            <Ionicons name="close-circle" size={18} color={cloudDesign.textMuted} />
          </TouchableOpacity>
        ) : null}
        {onFilterPress ? (
          <TouchableOpacity onPress={onFilterPress} hitSlop={12} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={cloudDesign.textMid} />
            {filterBadgeCount > 0 && (
              <View style={[styles.badge, { backgroundColor: cloudDesign.sky }]}>
                <Text style={styles.badgeText}>{filterBadgeCount > 9 ? '9+' : filterBadgeCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  plush: {
    borderRadius: 22,
    padding: 10,
    borderWidth: 1,
    marginHorizontal: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: cloudDesign.radius.pill,
    paddingHorizontal: 14,
    height: 40,
    gap: 8,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  filterBtn: {
    paddingLeft: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
  },
});
