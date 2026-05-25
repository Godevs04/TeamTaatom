import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { ConnectPageType } from '../services/connect';
import { theme as themeConstants } from '../constants/theme';
import { optimizeCloudinaryUrl } from '../utils/imageCache';
import { imageCacheManager } from '../utils/imageCacheManager';
import CloudGlassSurface, { useCloudGlassTokens } from './cloud/CloudGlassSurface';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

interface ConnectCardProps {
  page: ConnectPageType;
  onPress: () => void;
  onFollowPress?: () => void;
  isFollowing?: boolean;
  showFollowButton?: boolean;
}

export default function ConnectCard({
  page,
  onPress,
  onFollowPress,
  isFollowing = false,
  showFollowButton = true,
}: ConnectCardProps) {
  const { theme } = useTheme();
  const glass = useCloudGlassTokens();

  const ownerName = typeof page.userId === 'object' && page.userId ? page.userId.fullName : '';
  const ownerProfilePic = typeof page.userId === 'object' && page.userId ? page.userId.profilePic : '';

  const rawImageUrl = page.profileImage || ownerProfilePic || '';
  const cachedImageUri = rawImageUrl
    ? imageCacheManager.getCachedPathSync(rawImageUrl) || optimizeCloudinaryUrl(rawImageUrl, { width: 96, height: 96 })
    : '';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.76} style={styles.touchable}>
      <CloudGlassSurface style={styles.card} contentStyle={styles.cardContent} borderRadius={18}>
        <View style={styles.imageContainer}>
          {cachedImageUri ? (
            <Image
              source={{ uri: cachedImageUri }}
              style={[styles.profileImage, { borderColor: glass.isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)' }]}
              onLoad={() => imageCacheManager.cacheAfterDisplay(rawImageUrl)}
            />
          ) : (
            <View style={[styles.profileImagePlaceholder, { backgroundColor: glass.isDark ? 'rgba(255,255,255,0.08)' : theme.colors.border }]}>
              <Ionicons name="people" size={24} color={glass.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            {page.type === 'private' && (
              <Ionicons name="lock-closed" size={isTablet ? 15 : 13} color={glass.textMuted} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.pageName, { color: glass.textPrimary, flex: 1 }]} numberOfLines={1}>
              {page.name}
            </Text>
          </View>
          {ownerName ? (
            <Text style={[styles.ownerName, { color: glass.textSecondary }]} numberOfLines={1}>
              by {ownerName}
            </Text>
          ) : null}
          {page.bio ? (
            <Text style={[styles.bio, { color: glass.textSecondary }]} numberOfLines={2}>
              {page.bio}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={14} color={glass.textMuted} />
              <Text style={[styles.statText, { color: glass.textMuted }]}>
                {(page.followerCount || 0) + 1}
              </Text>
            </View>
            {page.features?.website && (
              <View style={styles.stat}>
                <Ionicons name="globe-outline" size={14} color={glass.textMuted} />
                <Text style={[styles.statText, { color: glass.textMuted }]}>Website</Text>
              </View>
            )}
            {page.features?.groupChat && (
              <View style={styles.stat}>
                <Ionicons name="chatbubbles-outline" size={14} color={glass.textMuted} />
                <Text style={[styles.statText, { color: glass.textMuted }]}>Chat</Text>
              </View>
            )}
          </View>
        </View>

        {showFollowButton && onFollowPress ? (
          <TouchableOpacity
            onPress={onFollowPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.followHit}
          >
            {isFollowing ? (
              <View style={[styles.followGhost, { backgroundColor: glass.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0, 0, 0, 0.06)' }]}>
                <Text style={[styles.followButtonText, { color: glass.textPrimary }]}>Following</Text>
              </View>
            ) : (
              <LinearGradient
                colors={['#1F2026', '#121318']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.followFilled}
              >
                <Text style={[styles.followButtonText, { color: '#FFFFFF' }]}>Follow</Text>
              </LinearGradient>
            )}
          </TouchableOpacity>
        ) : null}
      </CloudGlassSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginBottom: isTablet ? themeConstants.spacing.md : 10,
  },
  card: {
    marginBottom: 0,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: isTablet ? 14 : 12,
    paddingHorizontal: isTablet ? 14 : 12,
  },
  imageContainer: {
    marginRight: isTablet ? themeConstants.spacing.md : 12,
  },
  profileImage: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    borderWidth: 2,
  },
  profileImagePlaceholder: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pageName: {
    fontSize: isTablet ? 17 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  ownerName: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  bio: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    lineHeight: isTablet ? 18 : 16,
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followHit: {
    alignSelf: 'center',
  },
  followFilled: {
    paddingHorizontal: isTablet ? 16 : 14,
    paddingVertical: isTablet ? 8 : 7,
    borderRadius: themeConstants.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followGhost: {
    paddingHorizontal: isTablet ? 16 : 14,
    paddingVertical: isTablet ? 8 : 7,
    borderRadius: themeConstants.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followButtonText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});
