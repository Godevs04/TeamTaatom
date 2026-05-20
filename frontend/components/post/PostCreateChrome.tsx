import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Rect } from 'react-native-svg';
import { useCloudGlassCardTokens } from '../cloud/CloudGlassCard';
import { cloudDesign } from '../../constants/cloudDesign';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PostCreateChromeProps {
  postType: 'photo' | 'short';
  onPostTypeChange: (type: 'photo' | 'short') => void;
  onClose?: () => void;
}

export function PostCreateHeader({ onClose }: { onClose?: () => void }) {
  const glass = useCloudGlassCardTokens();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topBarHeight = isWeb ? 56 : (56 + (insets.top || 0));
  const topBarBg = glass.isDark ? '#0D1B2A' : '#FFFFFF';
  const textColor = glass.isDark ? '#FFFFFF' : '#122236';
  const subtitleColor = glass.isDark ? 'rgba(255,255,255,0.6)' : 'rgba(18,34,54,0.55)';

  return (
    <>
      <View style={[styles.solidTopBar, { height: topBarHeight, paddingTop: topBarHeight - 56, backgroundColor: topBarBg }]}>
        <View style={styles.topBarContent}>
          <Pressable
            onPress={onClose}
            style={styles.topBarButton}
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={textColor} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={[styles.topBarTitle, { color: textColor }]}>New Post</Text>
            <Text style={[styles.topBarSubtitle, { color: subtitleColor }]}>Share your journey ✨</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
      </View>
      {/* Shadow Gate */}
      <LinearGradient
        colors={[glass.isDark ? 'rgba(13,27,42,0.7)' : 'rgba(0,0,0,0.08)', 'transparent']}
        style={styles.topBarShadow}
      />
    </>
  );
}

export function PostMediaTypeToggle({ postType, onPostTypeChange }: PostCreateChromeProps) {
  const glass = useCloudGlassCardTokens();

  const tabs = [
    { key: 'photo' as const, label: 'Photo', icon: 'image-outline' as const },
    { key: 'short' as const, label: 'Short', icon: 'film-outline' as const },
  ];

  return (
    <View
      style={[
        styles.toggleWrap,
        {
          backgroundColor: glass.fill,
          borderColor: glass.border,
          shadowColor: glass.shadowColor,
          shadowOpacity: glass.shadowOpacity,
        },
        cloudDesign.shadowCard,
      ]}
    >
      <BlurView
        intensity={glass.blurIntensity}
        tint={glass.isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFillObject}
        {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
      />
      {tabs.map((tab) => {
        const active = postType === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={[styles.toggleSeg, active && styles.toggleSegActive]}
            onPress={() => onPostTypeChange(tab.key)}
          >
            {active ? (
              <View
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.toggleActiveBg,
                  { backgroundColor: glass.isDark ? 'rgba(91,188,248,0.35)' : 'rgba(255,255,255,0.92)' },
                ]}
              />
            ) : null}
            <Ionicons
              name={tab.icon}
              size={16}
              color={active ? (glass.isDark ? '#fff' : cloudDesign.blueDeep) : glass.textMuted}
            />
            <Text
              style={[
                styles.toggleLabel,
                { color: active ? (glass.isDark ? '#fff' : cloudDesign.blueDeep) : glass.textMuted },
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
  const glass = useCloudGlassCardTokens();
  const isPhoto = postType === 'photo';
  const [zoneSize, setZoneSize] = useState({ w: 0, h: 0 });
  const onZoneLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setZoneSize({ w: width, h: height });
  };
  const dashStroke = glass.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(91,188,248,0.28)';

  return (
    <View style={styles.emptyOuter}>
      <View
        style={[
          styles.mainCard,
          {
            borderColor: glass.border,
            backgroundColor: glass.fill,
            shadowColor: glass.shadowColor,
            shadowOpacity: glass.shadowOpacity,
          },
        ]}
      >
        <BlurView
          intensity={glass.blurIntensity}
          tint={glass.isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
          {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})}
        />
        <LinearGradient
          colors={[glass.insetTop, 'transparent']}
          style={styles.insetLine}
          pointerEvents="none"
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
            <LinearGradient colors={cloudDesign.buttonGradient} style={StyleSheet.absoluteFillObject} />
            <Ionicons name={isPhoto ? 'image' : 'videocam'} size={28} color="#fff" />
            <View style={styles.plusBadge}>
              <Ionicons name="add" size={14} color="#fff" />
            </View>
          </View>
          <Text style={[styles.uploadTitle, { color: glass.textPrimary }]}>{title}</Text>
          <Text style={[styles.uploadSub, { color: glass.textSecondary }]}>{subtitle}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionCard} onPress={onPickLibrary}>
            <View style={[styles.actionInner, { borderColor: glass.border, backgroundColor: glass.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)' }]}>
              <View style={styles.actionIcon}>
                <LinearGradient colors={cloudDesign.buttonGradient} style={StyleSheet.absoluteFillObject} />
                <Ionicons name={isPhoto ? 'images' : 'film'} size={22} color="#fff" />
              </View>
              <Text style={[styles.actionTitle, { color: glass.textPrimary }]}>Choose from Library</Text>
              <Text style={[styles.actionSub, { color: glass.textSecondary }]}>Browse your photos</Text>
            </View>
          </Pressable>
          <Pressable style={styles.actionCard} onPress={onTakeMedia}>
            <View style={[styles.actionInner, { borderColor: glass.border, backgroundColor: glass.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.35)' }]}>
              <View style={styles.actionIcon}>
                <LinearGradient colors={cloudDesign.buttonGradient} style={StyleSheet.absoluteFillObject} />
                <Ionicons name={isPhoto ? 'camera' : 'videocam'} size={22} color="#fff" />
              </View>
              <Text style={[styles.actionTitle, { color: glass.textPrimary }]}>
                Take {isPhoto ? 'Photo' : 'Video'}
              </Text>
              <Text style={[styles.actionSub, { color: glass.textSecondary }]}>Capture the moment</Text>
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
