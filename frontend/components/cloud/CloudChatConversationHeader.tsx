import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { cloudDesign } from '../../constants/cloudDesign';
import CloudAvatarStack from './CloudAvatarStack';

interface CloudChatConversationHeaderProps {
  title: string;
  onBack: () => void;
  avatarUris?: string[];
  typingText?: string | null;
  rightAction?: React.ReactNode;
  onTitlePress?: () => void;
}

export default function CloudChatConversationHeader({
  title,
  onBack,
  avatarUris = [],
  typingText,
  rightAction,
  onTitlePress,
}: CloudChatConversationHeaderProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';
  const titleColor = isDark ? theme.colors.text : cloudDesign.textDark;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={isDark ? ['#102236', '#07111C'] : ['#FFFFFF', '#F5F7FA']}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurView intensity={isDark ? 40 : 20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      <View style={styles.border} />
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={24} color={titleColor} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.center} onPress={onTitlePress} activeOpacity={onTitlePress ? 0.7 : 1} disabled={!onTitlePress}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
          {typingText ? (
            <View style={styles.typingPill}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]} />
                <View style={[styles.dot, styles.dot2, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]} />
                <View style={[styles.dot, styles.dot3, { backgroundColor: isDark ? '#FFFFFF' : '#121212' }]} />
              </View>
              <Text style={styles.typingText} numberOfLines={1}>{typingText}</Text>
            </View>
          ) : avatarUris.length > 0 ? (
            <CloudAvatarStack uris={avatarUris} size={26} max={6} />
          ) : null}
        </TouchableOpacity>
        <View style={styles.right}>{rightAction}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.8)',
  },
  border: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: cloudDesign.textDark,
    fontFamily: undefined,
  },
  typingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    borderRadius: cloudDesign.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: cloudDesign.sky,
    opacity: 0.7,
  },
  dot2: { opacity: 0.85 },
  dot3: { opacity: 1 },
  typingText: {
    fontSize: 10,
    fontWeight: '700',
    color: cloudDesign.blueDeep,
    flexShrink: 1,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});
