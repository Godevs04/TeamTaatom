import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';

interface CloudListRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showDivider?: boolean;
  iconTint?: string;
}

/** Flat row for inside glass surfaces — no nested card border */
export default function CloudListRow({
  icon,
  title,
  subtitle,
  onPress,
  showDivider = true,
  iconTint,
}: CloudListRowProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';

  const textPrimary = isDark ? theme.colors.text : cloudDesign.textDark;
  const textMuted = isDark ? theme.colors.textSecondary : cloudDesign.textMuted;
  const dividerColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91, 188, 248, 0.12)';
  const iconBg = isDark ? 'rgba(91, 188, 248, 0.14)' : 'rgba(91, 188, 248, 0.12)';
  const accent = iconTint || (isDark ? theme.colors.primary : cloudDesign.blueDeep);

  const content = (
    <>
      {showDivider ? <View style={[styles.divider, { backgroundColor: dividerColor }]} /> : null}
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={accent} />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={textMuted} />
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }
  return <View>{content}</View>;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 3,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.72,
  },
});
