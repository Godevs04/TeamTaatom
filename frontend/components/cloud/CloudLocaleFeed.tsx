import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, Platform } from 'react-native';
import { useCloudGlassTokens } from './CloudGlassSurface';
import { CloudLocaleHeroCard, CloudLocaleCardData } from './CloudLocaleCard';
import ScrollEdgeFades from '../ScrollEdgeFades';
import { useTheme } from '../../context/ThemeContext';

interface CloudLocaleFeedProps {
  locales: CloudLocaleCardData[];
  userCoords?: { latitude: number; longitude: number } | null;
  getDistanceText?: (locale: CloudLocaleCardData) => string;
  onLocalePress: (locale: CloudLocaleCardData) => void;
  onSavePress?: (locale: CloudLocaleCardData) => void;
  isSaved?: (id: string) => boolean;
  showNearest?: boolean;
  featuredTitle?: string;
}

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * One-locale-at-a-time horizontal carousel (paging) with soft edge fades,
 * for Saved / featured locale strips.
 */
export default function CloudLocaleFeed({
  locales,
  userCoords,
  getDistanceText,
  onLocalePress,
  onSavePress,
  isSaved,
  showNearest: _showNearest = true,
  featuredTitle = 'Saved Locales 🔖',
}: CloudLocaleFeedProps) {
  const glass = useCloudGlassTokens();
  const { isDark } = useTheme();
  const pageWidth = SCREEN_W;

  const data = useMemo(() => (locales || []).filter(Boolean), [locales]);

  if (!data.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: glass.textPrimary }]}>{featuredTitle}</Text>
      <View style={styles.carouselSlot}>
        <FlatList
          data={data || []}
          keyExtractor={(item) => String(item._id || item.name)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageWidth}
          snapToAlignment="center"
          disableIntervalMomentum
          getItemLayout={(_, index) => ({
            length: pageWidth,
            offset: pageWidth * index,
            index,
          })}
          contentContainerStyle={styles.carouselContent}
          renderItem={({ item }) => (
            <View style={[styles.page, { width: pageWidth }]}>
              <CloudLocaleHeroCard
                locale={item}
                userCoords={userCoords}
                distanceText={getDistanceText ? getDistanceText(item) : undefined}
                onPress={() => onLocalePress(item)}
                onSavePress={onSavePress ? () => onSavePress(item) : undefined}
                saved={item._id && isSaved ? isSaved(item._id) : false}
              />
            </View>
          )}
        />
        <ScrollEdgeFades isDark={isDark} variant="horizontal" horizontalFadeSize={40} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 2,
  },
  carouselSlot: {
    minHeight: Platform.OS === 'web' ? 320 : 280,
    position: 'relative',
  },
  carouselContent: {
    alignItems: 'stretch',
  },
  page: {
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
});
