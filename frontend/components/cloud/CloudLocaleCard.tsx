import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageStyle, Dimensions, Animated } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { cloudDesign, localeSubtitle } from '../../constants/cloudDesign';
import { useCloudGlassTokens } from './CloudGlassSurface';
import { optimizeCloudinaryUrl } from '../../utils/imageCache';

const SCREEN_WIDTH = Dimensions.get('window').width;
/** Explicit width — percentage width collapses inside FlatList headers */
export const LOCALE_HERO_CARD_WIDTH = SCREEN_WIDTH - 32;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

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
        {
          borderWidth: 1.5,
          borderColor: glass.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.25)',
          backgroundColor: glass.isDark ? '#0C1828' : '#FFFFFF',
          borderRadius: 20,
        }
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
        <BlurView
          intensity={95}
          tint={glass.isDark ? 'dark' : 'light'}
          style={[
            styles.cutout,
            {
              backgroundColor: glass.isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.5)',
              borderBottomColor: glass.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.45)',
              borderLeftColor: glass.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.45)',
              borderBottomWidth: 1.5,
              borderLeftWidth: 1.5,
            }
          ]}
        >
          <TouchableOpacity
            style={styles.cutoutInner}
            onPress={(e) => { e?.stopPropagation?.(); onSavePress(); }}
            hitSlop={10}
          >
            <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={isHero ? 20 : 14} color={saved ? '#FFD166' : (glass.isDark ? '#7AB3D6' : '#1C73B4')} />
          </TouchableOpacity>
        </BlurView>
      )}

      {distanceText ? (
        distanceText === 'Calculating...' || distanceText === 'loading' ? (
          <AnimatedBlurView
            intensity={95}
            tint={glass.isDark ? 'dark' : 'light'}
            style={[
              styles.distBadge,
              {
                opacity: pulseAnim,
                backgroundColor: glass.isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.5)',
                borderColor: glass.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                borderWidth: 1.5,
                justifyContent: 'center',
                alignItems: 'center',
              }
            ]}
          >
            <View style={{ width: 45, height: 8, backgroundColor: glass.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0, 0, 0, 0.15)', borderRadius: 4 }} />
          </AnimatedBlurView>
        ) : (
          <BlurView
            intensity={95}
            tint={glass.isDark ? 'dark' : 'light'}
            style={[
              styles.distBadge,
              {
                backgroundColor: glass.isDark ? 'rgba(15, 20, 30, 0.45)' : 'rgba(255, 255, 255, 0.5)',
                borderColor: glass.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.4)',
                borderWidth: 1.5,
                flexShrink: 1,
                maxWidth: '60%',
              }
            ]}
          >
            <Ionicons name="location-sharp" size={10} color={glass.isDark ? '#7AB3D6' : '#1C73B4'} />
            <Text style={[styles.distText, { flexShrink: 1, color: glass.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
              {distanceText}
            </Text>
          </BlurView>
        )
      ) : null}

      <BlurView
        intensity={95}
        tint={glass.isDark ? 'dark' : 'light'}
        style={[
          styles.dataPanel,
          isHero && styles.dataPanelHero,
          {
            backgroundColor: glass.isDark ? 'rgba(15, 20, 30, 0.4)' : 'rgba(255, 255, 255, 0.45)',
            borderTopColor: glass.isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.45)',
            borderTopWidth: 1.5,
            borderBottomLeftRadius: 18.5,
            borderBottomRightRadius: 18.5,
          },
        ]}
      >
        <Text style={[styles.name, isHero && styles.nameHero, { color: glass.textPrimary }]} numberOfLines={1}>
          {locale.name}
        </Text>
        <Text style={[styles.sub, { color: glass.textMuted }]} numberOfLines={1}>
          {localeSubtitle(locale)}
        </Text>
      </BlurView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: cloudDesign.radius.card,
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
    borderBottomLeftRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
  cutoutInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distBadge: {
    position: 'absolute',
    right: 12,
    bottom: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: cloudDesign.radius.pill,
    overflow: 'hidden',
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomLeftRadius: cloudDesign.radius.card,
    borderBottomRightRadius: cloudDesign.radius.card,
    overflow: 'hidden',
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
