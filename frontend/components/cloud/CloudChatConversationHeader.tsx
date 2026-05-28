import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
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
  username?: string;
}

export default function CloudChatConversationHeader({
  title,
  onBack,
  avatarUris = [],
  typingText,
  rightAction,
  onTitlePress,
  username,
}: CloudChatConversationHeaderProps) {
  const { theme, mode } = useTheme();
  const isDark =
    mode === 'dark' ||
    theme.colors.background === '#0B1A2B' ||
    theme.colors.background === '#000000';
  const titleColor = isDark ? theme.colors.text : cloudDesign.textDark;
  const displayUsername = username || `@${title.toLowerCase().replace(/[^a-z0-9_.]/g, '')}`;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={isDark ? ['#102236', '#07111C'] : ['#FFFFFF', '#F5F7FA']}
        style={StyleSheet.absoluteFillObject}
      />
      <BlurView intensity={isDark ? 40 : 20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
      <View style={styles.border} />
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack} style={[styles.back, { overflow: 'hidden', borderRadius: 20 }]} hitSlop={10}>
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.center} onPress={onTitlePress} activeOpacity={onTitlePress ? 0.7 : 1} disabled={!onTitlePress}>
          {avatarUris.length > 0 ? (
            <View style={styles.avatarWrapper}>
              <CloudAvatarStack uris={avatarUris} size={36} max={1} />
            </View>
          ) : null}
          <View style={styles.headerTextContainer}>
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
            {typingText ? (
              <Text style={styles.typingTextSub} numberOfLines={1}>{typingText}</Text>
            ) : (
              <Text style={[styles.username, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]} numberOfLines={1}>
                {displayUsername}
              </Text>
            )}
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: cloudDesign.textDark,
    fontFamily: undefined,
  },
  avatarWrapper: {
    marginRight: 10,
  },
  headerTextContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  username: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  typingTextSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3498db',
    marginTop: 1,
  },
  right: {
    minWidth: 40,
    alignItems: 'flex-end',
  },
});
