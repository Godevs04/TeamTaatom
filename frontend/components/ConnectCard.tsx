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
import { useTheme } from '../context/ThemeContext';
import { ConnectPageType } from '../services/connect';
import { theme as themeConstants } from '../constants/theme';
import { optimizeCloudinaryUrl } from '../utils/imageCache';

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

  const ownerName = typeof page.userId === 'object' ? page.userId.fullName : '';
  const ownerUsername = typeof page.userId === 'object' ? page.userId.username : '';
  const ownerProfilePic = typeof page.userId === 'object' ? page.userId.profilePic : '';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardContent}>
        {/* Profile Image */}
        <View style={styles.imageContainer}>
          {page.profileImage ? (
            <Image source={{ uri: optimizeCloudinaryUrl(page.profileImage, { width: 96, height: 96 }) }} style={styles.profileImage} />
          ) : ownerProfilePic ? (
            <Image source={{ uri: optimizeCloudinaryUrl(ownerProfilePic, { width: 96, height: 96 }) }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImagePlaceholder, { backgroundColor: theme.colors.border }]}>
              <Ionicons name="people" size={24} color={theme.colors.textSecondary} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            {page.type === 'private' && (
              <Ionicons name="lock-closed" size={isTablet ? 15 : 13} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
            )}
            <Text style={[styles.pageName, { color: theme.colors.text, flex: 1 }]} numberOfLines={1}>
              {page.name}
            </Text>
          </View>
          {ownerName ? (
            <Text style={[styles.ownerName, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              by {ownerName}
            </Text>
          ) : null}
          {page.bio ? (
            <Text style={[styles.bio, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {page.bio}
            </Text>
          ) : null}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>
                {(page.followerCount || 0) + 1}
              </Text>
            </View>
            {page.features?.website && (
              <View style={styles.stat}>
                <Ionicons name="globe-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>Website</Text>
              </View>
            )}
            {page.features?.groupChat && (
              <View style={styles.stat}>
                <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.statText, { color: theme.colors.textSecondary }]}>Chat</Text>
              </View>
            )}
          </View>
        </View>

        {/* Follow Button */}
        {showFollowButton && onFollowPress && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing
                ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }
                : { backgroundColor: theme.colors.primary },
            ]}
            onPress={onFollowPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.followButtonText,
                { color: isFollowing ? theme.colors.text : '#FFFFFF' },
              ]}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 1,
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginBottom: isTablet ? themeConstants.spacing.md : themeConstants.spacing.sm,
    padding: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    marginRight: isTablet ? themeConstants.spacing.md : 12,
  },
  profileImage: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
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
  followButton: {
    paddingHorizontal: isTablet ? 18 : 14,
    paddingVertical: isTablet ? 8 : 6,
    borderRadius: themeConstants.borderRadius.sm,
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
