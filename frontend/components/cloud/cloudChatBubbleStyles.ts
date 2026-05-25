import { StyleSheet, Dimensions } from 'react-native';
import { cloudDesign } from '../../constants/cloudDesign';

const { width: SCREEN_W } = Dimensions.get('window');
export const CHAT_BUBBLE_MAX_WIDTH = Math.min(SCREEN_W * 0.68, 280);
export const CHAT_MEDIA_MAX_WIDTH = Math.min(SCREEN_W * 0.58, 240);

export function isAppDarkMode(mode: string, background: string) {
  return (
    mode === 'dark' ||
    background === '#0B1A2B' ||
    background === '#000000' ||
    background === '#111114'
  );
}

export function createCloudChatBubbleStyles(
  isDark: boolean,
  theme: { colors: Record<string, any> }
) {
  return StyleSheet.create({
    messageRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 6,
    },
    bubbleColumn: {
      maxWidth: CHAT_BUBBLE_MAX_WIDTH,
      flexShrink: 1,
    },
    bubbleIn: {
      backgroundColor: isDark ? theme.colors.glassStrong : '#FFFFFF',
      borderWidth: 1,
      borderColor: isDark ? theme.colors.glassBorder : 'rgba(0, 0, 0, 0.08)',
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomRightRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      overflow: 'hidden',
      shadowColor: isDark ? theme.colors.glowBlue || theme.colors.primary : 'rgba(0, 0, 0, 0.04)',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: isDark ? 0.2 : 1,
      shadowRadius: 12,
      elevation: 3,
    },
    bubbleOut: {
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 8,
      overflow: 'hidden',
      shadowColor: 'rgba(0, 0, 0, 0.16)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 5,
    },
    textIn: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? theme.colors.text : cloudDesign.textDark,
      lineHeight: 20,
    },
    textOut: {
      fontSize: 14,
      fontWeight: '500',
      color: '#FFFFFF',
      lineHeight: 20,
    },
    senderName: {
      fontSize: 11,
      fontWeight: '700',
      color: isDark ? theme.colors.textSecondary : cloudDesign.textMuted,
      marginBottom: 4,
      marginLeft: 36,
    },
    timeIn: {
      fontSize: 10,
      color: isDark ? theme.colors.textSecondary : cloudDesign.textMuted,
      marginTop: 4,
      textAlign: 'right',
    },
    timeOut: {
      fontSize: 10,
      color: 'rgba(255,255,255,0.65)',
      marginTop: 4,
      textAlign: 'right',
    },
    avatarSpacer: {
      width: 28,
      marginRight: 8,
    },
  });
}
