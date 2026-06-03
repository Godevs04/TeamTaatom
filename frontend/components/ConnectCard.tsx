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
import GradientText from './ui/GradientText';

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

  const cardBorderColor = glass.isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(28, 115, 180, 0.22)';
  const cardBgColor = glass.isDark ? 'rgba(25, 25, 25, 0.76)' : 'rgba(255, 255, 255, 0.88)';
  const cardShadowColor = glass.isDark ? '#000000' : '#1C73B4';

  const normalCount = Math.max(0, Math.floor((page.followerCount || 0) + 1));
  const isCommunityPage = (page.type as string) === 'community' || page.category === 'community';
  const displayMemberCount = isCommunityPage ? Math.max(0, normalCount - 1) : normalCount;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.76} style={styles.touchable}>
      <CloudGlassSurface
        style={[
          styles.card,
          {
            backgroundColor: cardBgColor,
            borderColor: cardBorderColor,
            borderWidth: 1.2,
            shadowColor: cardShadowColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: glass.isDark ? 0.35 : 0.09,
            shadowRadius: 12,
            elevation: glass.isDark ? 3 : 5,
          }
        ]}
        contentStyle={styles.cardContent}
        borderRadius={18}
      >
        <View style={styles.imageContainer}>
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 2,
              borderRadius: isTablet ? 30 : 26,
            }}
          >
            {cachedImageUri ? (
              <Image
                source={{ uri: cachedImageUri }}
                style={styles.profileImage}
                onLoad={() => imageCacheManager.cacheAfterDisplay(rawImageUrl)}
              />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: glass.isDark ? 'rgba(0, 0, 0, 0.75)' : '#FFFFFF' }]}>
                <Ionicons name="people" size={24} color={theme.colors.primary} />
              </View>
            )}
          </LinearGradient>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            {page.type === 'private' && (
              <Ionicons name="lock-closed" size={isTablet ? 15 : 13} color={theme.colors.primary} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.pageName, { color: glass.textPrimary, flex: 1 }]} numberOfLines={1}>
              {page.name}
            </Text>
          </View>
          {ownerName ? (
            <Text style={[styles.ownerName, { color: theme.colors.primary }]} numberOfLines={1}>
              by {ownerName}
            </Text>
          ) : null}
          {page.bio ? (
            <Text style={[styles.bio, { color: theme.colors.primary }]} numberOfLines={2}>
              {page.bio}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={14} color={theme.colors.primary} />
              <Text style={[styles.statText, { color: theme.colors.primary }]}>
                {String(displayMemberCount)}
              </Text>
            </View>
            {page.features?.website && (
              <View style={styles.stat}>
                <Ionicons name="globe-outline" size={14} color={theme.colors.link} />
                <Text style={[styles.statText, { color: theme.colors.link }]}>Website</Text>
              </View>
            )}
            {page.features?.groupChat && (
              <View style={styles.stat}>
                <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.link} />
                <Text style={[styles.statText, { color: theme.colors.link }]}>Chat</Text>
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
                colors={theme.colors.gradient.button as [string, string]}
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
    marginVertical: 6,
    marginHorizontal: 12,
  },
  card: {
    padding: 16,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    marginRight: 16,
  },
  profileImage: {
    width: isTablet ? 60 : 52,
    height: isTablet ? 60 : 52,
    borderRadius: isTablet ? 28 : 24,
  },
  profileImagePlaceholder: {
    width: isTablet ? 60 : 52,
    height: isTablet ? 60 : 52,
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
