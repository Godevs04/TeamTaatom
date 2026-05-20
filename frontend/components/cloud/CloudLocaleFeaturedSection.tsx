import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useCloudGlassTokens } from './CloudGlassSurface';
import { CloudLocaleHeroCard, CloudLocaleMiniCard, CloudLocaleCardData } from './CloudLocaleCard';

interface CloudLocaleFeaturedSectionProps {
  locales: CloudLocaleCardData[];
  getDistanceText: (locale: CloudLocaleCardData) => string;
  onLocalePress: (locale: CloudLocaleCardData, distanceKm?: string) => void;
  onSavePress?: (locale: CloudLocaleCardData) => void;
  isSaved?: (id: string) => boolean;
  title?: string;
}

export default function CloudLocaleFeaturedSection({
  locales,
  getDistanceText,
  onLocalePress,
  onSavePress,
  isSaved,
  title = 'Featured Locales 📍',
}: CloudLocaleFeaturedSectionProps) {
  const glass = useCloudGlassTokens();
  if (!locales.length) return null;

  const hero = locales[0];
  const rest = locales.slice(1);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: glass.textPrimary }]}>{title}</Text>
      <View style={styles.heroWrap}>
      <CloudLocaleHeroCard
        locale={hero}
        distanceText={getDistanceText(hero)}
        onPress={() => onLocalePress(hero, getDistanceText(hero))}
        onSavePress={onSavePress ? () => onSavePress(hero) : undefined}
        saved={hero._id && isSaved ? isSaved(hero._id) : false}
      />
      </View>
      {rest.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.carousel}
        >
          {rest.map((locale) => (
            <CloudLocaleMiniCard
              key={locale._id || locale.name}
              locale={locale}
              distanceText={getDistanceText(locale)}
              onPress={() => onLocalePress(locale, getDistanceText(locale))}
              onSavePress={onSavePress ? () => onSavePress(locale) : undefined}
              saved={locale._id && isSaved ? isSaved(locale._id) : false}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 2,
  },
  heroWrap: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  carousel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 12,
    paddingBottom: 4,
  },
});
