import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, LayoutChangeEvent, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Rect } from 'react-native-svg';
import { useCloudGlassCardTokens } from '../cloud/CloudGlassCard';
import { cloudDesign } from '../../constants/cloudDesign';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface PostCreateChromeProps {
  postType: 'photo' | 'short';
  onPostTypeChange: (type: 'photo' | 'short') => void;
  onClose?: () => void;
}

export function PostCreateHeader({
  onClose,
  onNext,
  nextText = 'Next',
  showNext = true,
  isDetail = false,
}: {
  onClose?: () => void;
  onNext?: () => void;
  nextText?: string;
  showNext?: boolean;
  isDetail?: boolean;
}) {
  const { theme, mode } = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = mode === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#122236';

  const isAndroid = Platform.OS === 'android';
  const { width: screenWidth } = Dimensions.get('window');
  const isTablet = screenWidth >= 768;

  return (
    <View style={{
      width: '100%',
      paddingTop: insets.top,
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
      borderBottomWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.15)',
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.1,
      shadowRadius: 10,
      elevation: 4,
      overflow: 'hidden',
      zIndex: 100,
      position: 'relative',
    }}>
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.topBarContent}>
        <Pressable
          onPress={onClose}
          style={styles.topBarButton}
          accessibilityLabel={isDetail ? "Back" : "Close"}
        >
          <Ionicons name={isDetail ? "arrow-back" : "close"} size={26} color={textColor} />
        </Pressable>
        <View style={styles.topBarCenter}>
          <Text style={[styles.topBarTitle, { color: textColor }]}>New post</Text>
        </View>
        <View style={[styles.topBarButton, { alignItems: 'flex-end', minWidth: 60 }]}>
          {showNext && onNext ? (
            <Pressable onPress={onNext} hitSlop={12}>
              <Text style={{ color: '#14B8A6', fontWeight: 'bold', fontSize: 16 }}>{nextText}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>
      </View>
    </View>
  );
}

export function PostMediaTypeToggle({ postType, onPostTypeChange }: PostCreateChromeProps) {
  const { theme, mode } = useTheme();
  const isDark = mode === 'dark';

  const tabs = [
    { key: 'photo' as const, label: 'Photo', icon: 'image-outline' as const },
    { key: 'short' as const, label: 'Short', icon: 'film-outline' as const },
  ];

  return (
    <View
      style={[
        styles.toggleWrap,
        {
          backgroundColor: isDark ? 'rgba(10, 15, 25, 0.5)' : 'rgba(255, 255, 255, 0.4)',
          borderColor: theme.colors.border,
          borderWidth: 1.5,
          overflow: 'hidden',
        },
      ]}
    >
      {tabs.map((tab) => {
        const active = postType === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.toggleSeg, { position: 'relative', overflow: 'hidden' }]}
            onPress={() => onPostTypeChange(tab.key)}
          >
            {active && (
              <LinearGradient
                colors={['#38BDF8', '#14B8A6', '#34D399']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Ionicons
              name={tab.icon}
              size={16}
              color={active ? '#FFFFFF' : theme.colors.textSecondary}
              style={{ zIndex: 1 }}
            />
            <Text
              style={[
                styles.toggleLabel,
                { color: active ? '#FFFFFF' : theme.colors.textSecondary, zIndex: 1 },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface PostCreateEmptyCardProps {
  postType: 'photo' | 'short';
  title: string;
  subtitle: string;
  onPickLibrary: () => void;
  onTakeMedia: () => void;
}

export function PostCreateEmptyCard({
  postType,
  title,
  subtitle,
  onPickLibrary,
  onTakeMedia,
}: PostCreateEmptyCardProps) {
  const { theme, mode } = useTheme();
  const isPhoto = postType === 'photo';
  const [zoneSize, setZoneSize] = useState({ w: 0, h: 0 });
  const onZoneLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setZoneSize({ w: width, h: height });
  };
  const dashStroke = theme.colors.secondary + '40';

  const isDark = mode === 'dark';

  return (
    <View style={styles.emptyOuter}>
      <View
        style={[
          styles.mainCard,
          {
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)',
            borderWidth: 1,
            backgroundColor: isDark ? 'rgba(20, 24, 30, 0.45)' : 'rgba(255, 255, 255, 0.35)',
          },
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <View
          style={[
            styles.uploadZone,
            Platform.OS === 'android' ? styles.uploadZoneAndroid : { borderColor: dashStroke },
          ]}
          onLayout={onZoneLayout}
        >
          {Platform.OS === 'android' && zoneSize.w > 0 ? (
            <Svg width={zoneSize.w} height={zoneSize.h} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Rect
                x={1}
                y={1}
                width={zoneSize.w - 2}
                height={zoneSize.h - 2}
                rx={22}
                fill="none"
                stroke={dashStroke}
                strokeWidth={1.5}
                strokeDasharray="8 6"
              />
            </Svg>
          ) : null}
          <View style={styles.uploadIconWrap}>
            <LinearGradient
              colors={['#38BDF8', '#14B8A6', '#34D399']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Ionicons name={isPhoto ? 'image' : 'videocam'} size={28} color="#fff" style={{ zIndex: 1 }} />
            <View style={[styles.plusBadge, { backgroundColor: '#14B8A6' }]}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.uploadSub, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionCard} onPress={onPickLibrary}>
            <View style={[
              styles.actionInner, 
              { 
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)', 
                backgroundColor: isDark ? 'rgba(20, 24, 30, 0.35)' : 'rgba(255, 255, 255, 0.25)',
                borderWidth: 1,
                overflow: 'hidden'
              }
            ]}>
              <BlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.actionIcon}>
                <LinearGradient
                  colors={['#38BDF8', '#14B8A6', '#34D399']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name={isPhoto ? 'images' : 'film'} size={22} color="#fff" style={{ zIndex: 1 }} />
              </View>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>Choose from Library</Text>
              <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Browse your photos</Text>
            </View>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={onTakeMedia}>
            <View style={[
              styles.actionInner, 
              { 
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.45)', 
                backgroundColor: isDark ? 'rgba(20, 24, 30, 0.35)' : 'rgba(255, 255, 255, 0.25)',
                borderWidth: 1,
                overflow: 'hidden'
              }
            ]}>
              <BlurView
                intensity={80}
                tint={isDark ? 'dark' : 'light'}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.actionIcon}>
                <LinearGradient
                  colors={['#38BDF8', '#14B8A6', '#34D399']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFillObject}
                />
                <Ionicons name={isPhoto ? 'camera' : 'videocam'} size={22} color="#fff" style={{ zIndex: 1 }} />
              </View>
              <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                Take {isPhoto ? 'Photo' : 'Video'}
              </Text>
              <Text style={[styles.actionSub, { color: theme.colors.textSecondary }]}>Capture the moment</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  solidTopBar: {
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  topBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  topBarButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  topBarSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  topBarShadow: {
    height: 4,
    zIndex: 99,
  },
  toggleWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 999,
    borderWidth: 1,
    padding: 4,
    overflow: 'hidden',
  },
  toggleSeg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  toggleSegActive: {},
  toggleActiveBg: {
    borderRadius: 999,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  emptyOuter: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mainCard: {
    borderRadius: cloudDesign.radius.postCard,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
    shadowOffset: cloudDesign.postGlass.shadowOffset,
    shadowRadius: cloudDesign.postGlass.shadowRadius,
    elevation: cloudDesign.postGlass.elevation,
  },
  insetLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  uploadZone: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 22,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    position: 'relative',
  },
  uploadZoneAndroid: {
    borderWidth: 0,
  },
  uploadIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 14,
  },
  plusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: cloudDesign.blueDeep,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  uploadSub: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
  },
  actionInner: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 10,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionSub: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
