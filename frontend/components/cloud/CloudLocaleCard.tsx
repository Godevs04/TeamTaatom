import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageStyle, Dimensions, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { cloudDesign, localeSubtitle } from '../../constants/cloudDesign';
import { useCloudGlassTokens } from './CloudGlassSurface';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Explicit width — percentage width collapses inside FlatList headers */
export const LOCALE_HERO_CARD_WIDTH = SCREEN_WIDTH - 32;

export interface CloudLocaleCardData {
  _id?: string;
  name: string;
  countryCode?: string;
  imageUrl?: string;
  spotTypes?: string[];
  travelInfo?: string;
  description?: string;
}

interface CloudLocaleCardProps {
  locale: CloudLocaleCardData;
  distanceText?: string;
  variant: 'hero' | 'mini';
  onPress: () => void;
  onSavePress?: () => void;
  saved?: boolean;
  miniFullWidth?: boolean;
}

export function CloudLocaleHeroCard(props: Omit<CloudLocaleCardProps, 'variant'>) {
  return <CloudLocaleCard {...props} variant="hero" />;
}

export function CloudLocaleMiniCard(props: Omit<CloudLocaleCardProps, 'variant'>) {
  return <CloudLocaleCard {...props} variant="mini" />;
}

export function CloudLocaleMiniCardWide(props: Omit<CloudLocaleCardProps, 'variant' | 'miniFullWidth'>) {
  return <CloudLocaleCard {...props} variant="mini" miniFullWidth />;
}

function CloudLocaleCard({
  locale,
  distanceText,
  variant,
  onPress,
  onSavePress,
  saved,
  miniFullWidth,
}: CloudLocaleCardProps) {
  const glass = useCloudGlassTokens();
  const isHero = variant === 'hero';
  const height = isHero ? 200 : 130;
  const width = isHero ? LOCALE_HERO_CARD_WIDTH : miniFullWidth ? ('100%' as const) : 110;

  const cardStyle = isHero
    ? { height, width: LOCALE_HERO_CARD_WIDTH, minWidth: LOCALE_HERO_CARD_WIDTH, maxWidth: LOCALE_HERO_CARD_WIDTH }
    : { height, width };

  // Pulsing animation for skeleton shimmers
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (distanceText === 'Calculating...' || distanceText === 'loading') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [distanceText, pulseAnim]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.card,
        isHero ? styles.hero : styles.mini,
        cardStyle,
        cloudDesign.shadowCard,
      ]}
    >
      <View style={[styles.imageWrapper, { height }]} key={String(locale._id || '')}>
        {locale.imageUrl ? (
          <ExpoImage
            source={{ uri: optimizeCloudinaryUrl(locale.imageUrl, { width: isHero ? 800 : 220, height: isHero ? 500 : 260 }) }}
            style={styles.image as ImageStyle}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={120}
          />
        ) : (
          <LinearGradient
            colors={[cloudDesign.skyLight, cloudDesign.sky]}
            style={styles.image}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="location" size={isHero ? 48 : 28} color="#fff" style={{ alignSelf: 'center', marginTop: isHero ? 60 : 36 }} />
          </LinearGradient>
        )}
      </View>

      {onSavePress && (
        <TouchableOpacity style={styles.cutout} onPress={(e) => { e?.stopPropagation?.(); onSavePress(); }} hitSlop={10}>
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={isHero ? 20 : 14} color={saved ? '#FFD166' : cloudDesign.blueDeep} />
        </TouchableOpacity>
      )}

      {distanceText ? (
        distanceText === 'Calculating...' || distanceText === 'loading' ? (
          <Animated.View
            style={[
              styles.distBadge,
              {
                opacity: pulseAnim,
                width: 70,
                height: 22,
                backgroundColor: glass.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: glass.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.02)',
                justifyContent: 'center',
                alignItems: 'center',
              }
            ]}
          >
            <View style={{ width: 45, height: 8, backgroundColor: glass.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0, 0, 0, 0.08)', borderRadius: 4 }} />
          </Animated.View>
        ) : (
          <View style={[
            styles.distBadge,
            {
              backgroundColor: glass.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0, 0, 0, 0.06)',
              borderColor: glass.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0, 0, 0, 0.04)',
              flexShrink: 1,
              maxWidth: '60%',
            }
          ]}>
            <Ionicons name="location-sharp" size={10} color={glass.textSecondary} />
            <Text style={[styles.distText, { flexShrink: 1, color: glass.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
              {distanceText}
            </Text>
          </View>
        )
      ) : null}

      <View
        style={[
          styles.dataPanel,
          isHero && styles.dataPanelHero,
          {
            backgroundColor: glass.isDark ? 'rgba(12, 24, 40, 0.88)' : 'rgba(255,255,255,0.94)',
            borderTopColor: glass.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)',
          },
        ]}
      >
        <Text style={[styles.name, isHero && styles.nameHero, { color: glass.textPrimary }]} numberOfLines={1}>
          {locale.name}
        </Text>
        <Text style={[styles.sub, { color: glass.textMuted }]} numberOfLines={1}>
          {localeSubtitle(locale)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: cloudDesign.radius.card,
    overflow: 'hidden',
    backgroundColor: '#fff',
    position: 'relative',
  },
  hero: {
    alignSelf: 'center',
  },
  mini: {
    flexShrink: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  imageWrapper: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
  cutout: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    ...cloudDesign.shadowCard,
  },
  distBadge: {
    position: 'absolute',
    right: 12,
    bottom: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: cloudDesign.radius.pill,
    zIndex: 2,
  },
  distText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dataPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: cloudDesign.radius.card,
    borderBottomRightRadius: cloudDesign.radius.card,
  },
  dataPanelHero: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  name: {
    fontSize: 11,
    fontWeight: '800',
    color: cloudDesign.textDark,
  },
  nameHero: {
    fontSize: 16,
    fontWeight: '900',
  },
  sub: {
    fontSize: 9,
    fontWeight: '600',
    color: cloudDesign.textMuted,
    marginTop: 2,
  },
});
