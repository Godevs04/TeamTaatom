import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCloudGlassTokens } from './CloudGlassSurface';
import { CloudLocaleHeroCard, CloudLocaleMiniCard, CloudLocaleMiniCardWide, CloudLocaleCardData } from './CloudLocaleCard';
import CloudLocaleFeaturedSection from './CloudLocaleFeaturedSection';

interface CloudLocaleFeedProps {
  locales: CloudLocaleCardData[];
  getDistanceText: (locale: CloudLocaleCardData) => string;
  onLocalePress: (locale: CloudLocaleCardData) => void;
  onSavePress?: (locale: CloudLocaleCardData) => void;
  isSaved?: (id: string) => boolean;
  showNearest?: boolean;
  featuredTitle?: string;
}

/** Hero + up to 3 in horizontal carousel under Featured */
const FEATURED_CAP = 4;

export default function CloudLocaleFeed({
  locales,
  getDistanceText,
  onLocalePress,
  onSavePress,
  isSaved,
  showNearest = true,
  featuredTitle = 'Featured Locales 📍',
}: CloudLocaleFeedProps) {
  const glass = useCloudGlassTokens();
  if (!locales.length) return null;

  const nearest = showNearest ? locales[0] : null;
  const afterNearest = showNearest ? locales.slice(1) : locales;
  const featured = afterNearest.slice(0, FEATURED_CAP);
  const more = afterNearest.slice(FEATURED_CAP);

  return (
    <View style={styles.wrap}>
      {nearest ? (
        <View style={styles.nearestBlock}>
          <Text style={[styles.sectionTitle, { color: glass.textPrimary }]}>Nearest to You 🧭</Text>
          <View style={styles.padded}>
            <CloudLocaleHeroCard
              locale={nearest}
              distanceText={getDistanceText(nearest)}
              onPress={() => onLocalePress(nearest)}
              onSavePress={onSavePress ? () => onSavePress(nearest) : undefined}
              saved={nearest._id && isSaved ? isSaved(nearest._id) : false}
            />
          </View>
          <View style={styles.sectionGap} />
        </View>
      ) : null}

      {featured.length > 0 ? (
        <CloudLocaleFeaturedSection
          locales={featured}
          title={featuredTitle}
          getDistanceText={getDistanceText}
          onLocalePress={onLocalePress}
          onSavePress={onSavePress}
          isSaved={isSaved}
        />
      ) : null}

      {more.length > 0 ? (
        <View style={styles.moreBlock}>
          <Text style={[styles.sectionTitle, { color: glass.textPrimary }]}>More Nearby</Text>
          <View style={styles.moreGrid}>
            {more.map((locale) => (
              <View key={locale._id || locale.name} style={styles.moreItem}>
                <CloudLocaleMiniCardWide
                  locale={locale}
                  distanceText={getDistanceText(locale)}
                  onPress={() => onLocalePress(locale)}
                  onSavePress={onSavePress ? () => onSavePress(locale) : undefined}
                  saved={locale._id && isSaved ? isSaved(locale._id) : false}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 12,
  },
  nearestBlock: {},
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 2,
  },
  padded: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  sectionGap: {
    height: 16,
  },
  moreBlock: {
    marginTop: 4,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  moreItem: {
    width: '47%',
    minWidth: 150,
  },
});
