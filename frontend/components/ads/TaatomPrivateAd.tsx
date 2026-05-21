/**
 * TAATOM private (house) native-style promo card.
 * Shown on Connect website revisits and after the global 3 Google ads / 8h cap.
 * Does not count toward the Google AdMob impression limit.
 */

import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

const TAATOM_LOGO_URI =
  'https://res.cloudinary.com/dcvdqhqzc/image/upload/v1756537440/bokj2vfio8cenbo6wfea.png';
const DOWNLOAD_URL = 'https://taatom.com/download';

export type TaatomPrivateAdProps = {
  /** Stable key for list / screen identity */
  placementId?: string;
};

function TaatomPrivateAdComponent(_props: TaatomPrivateAdProps) {
  const { theme } = useTheme();

  const openDownload = () => {
    Linking.openURL(DOWNLOAD_URL).catch(() => {});
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <View style={[styles.sponsoredRow, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.sponsoredLabel, { color: theme.colors.textSecondary }]}>
          Promoted by Taatom
        </Text>
      </View>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Image source={{ uri: TAATOM_LOGO_URI }} style={styles.icon} resizeMode="cover" />
          <View style={styles.headlineBody}>
            <Text style={[styles.headline, { color: theme.colors.text }]} numberOfLines={2}>
              Share your journey on Taatom
            </Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              Post photos, track trips, and connect with travelers worldwide.
            </Text>
          </View>
        </View>
        <View style={[styles.mediaPlaceholder, { backgroundColor: theme.colors.primary + '18' }]}>
          <Text style={[styles.mediaText, { color: theme.colors.primary }]}>Explore Taatom</Text>
        </View>
        <TouchableOpacity onPress={openDownload} activeOpacity={0.8} accessibilityRole="button">
          <Text style={[styles.cta, { color: theme.colors.primary }]}>Get the app</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    ...(Platform.OS === 'android' ? { elevation: 2 } : {}),
  },
  sponsoredRow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sponsoredLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  content: {
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  headlineBody: {
    flex: 1,
    gap: 4,
  },
  headline: {
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  mediaPlaceholder: {
    height: 120,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaText: {
    fontSize: 15,
    fontWeight: '600',
  },
  cta: {
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 4,
  },
});

export const TaatomPrivateAd = memo(TaatomPrivateAdComponent);
export default TaatomPrivateAd;
