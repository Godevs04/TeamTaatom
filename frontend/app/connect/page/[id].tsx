import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { theme as themeConstants } from '../../../constants/theme';
import {
  getPageDetail,
  followConnectPage,
  unfollowConnectPage,
  deleteConnectPage,
  getPageFollowers,
  recordPageView,
  ConnectPageType,
  ContentBlock,
  ConnectFollowerUser,
} from '../../../services/connect';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { crashReportingService } from '../../../services/crashReporting';
import { optimizeCloudinaryUrl } from '../../../utils/imageCache';
import logger from '../../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function ConnectPageDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState<ConnectPageType | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<ConnectFollowerUser[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadPageDetail = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const response = await getPageDetail(id);
      setPage(response.page);
      setIsOwner(response.isOwner);
      setIsFollowing(response.isFollowing);
      // Record view (non-critical, fire and forget)
      recordPageView(id);
    } catch (error) {
      logger.error('Error loading page detail:', error);
      Alert.alert('Error', 'Failed to load page details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadPageDetail();
    }, [loadPageDetail])
  );

  const handleFollowToggle = async () => {
    if (!page || followLoading) return;
    try {
      setFollowLoading(true);
      // Optimistic update
      const wasFollowing = isFollowing;
      setIsFollowing(!wasFollowing);
      setPage(prev =>
        prev
          ? { ...prev, followerCount: prev.followerCount + (wasFollowing ? -1 : 1) }
          : prev
      );

      if (wasFollowing) {
        await unfollowConnectPage(page._id);
      } else {
        await followConnectPage(page._id);
      }
    } catch (error) {
      // Revert optimistic update
      setIsFollowing(isFollowing);
      setPage(prev =>
        prev
          ? { ...prev, followerCount: prev.followerCount + (isFollowing ? 0 : -1) }
          : prev
      );
      logger.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleOpenChat = async () => {
    if (!page?.chatRoomId) return;
    crashReportingService.addBreadcrumb('Opening connect page group chat', 'navigation', {
      pageId: page._id,
      pageName: page.name,
      chatRoomId: page.chatRoomId,
    });
    try {
      await AsyncStorage.setItem('pendingChatRoomId', page.chatRoomId);
    } catch (e) {
      logger.warn('Failed to store pendingChatRoomId:', e);
    }
    router.push('/chat');
  };

  const handleDeletePage = () => {
    if (!page) return;
    Alert.alert(
      'Delete Page',
      `Are you sure you want to delete "${page.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteConnectPage(page._id);
              Alert.alert('Deleted', 'Your connect page has been deleted.');
              router.back();
            } catch (error: any) {
              logger.error('Error deleting page:', error);
              Alert.alert('Error', error.message || 'Failed to delete page.');
            }
          },
        },
      ]
    );
  };

  const handleShowFollowers = async () => {
    if (!id) return;
    setShowFollowers(true);
    setFollowersLoading(true);
    try {
      const response = await getPageFollowers(id);
      setFollowers(response.followers || []);
    } catch (error) {
      logger.error('Error loading followers:', error);
    } finally {
      setFollowersLoading(false);
    }
  };

  const renderContentBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'heading':
        return (
          <Text
            key={block._id || index}
            style={[styles.contentHeading, { color: theme.colors.text }]}
          >
            {block.content}
          </Text>
        );
      case 'text':
        return (
          <Text
            key={block._id || index}
            style={[styles.contentText, { color: theme.colors.text }]}
          >
            {block.content}
          </Text>
        );
      case 'image':
        return (
          <Image
            key={block._id || index}
            source={{ uri: block.content }}
            style={styles.contentImage}
            resizeMode="cover"
          />
        );
      case 'video':
        return (
          <TouchableOpacity
            key={block._id || index}
            style={[styles.videoPlaceholder, { backgroundColor: theme.colors.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="play-circle" size={48} color={theme.colors.textSecondary} />
            <Text style={[styles.videoLabel, { color: theme.colors.textSecondary }]}>
              Video
            </Text>
          </TouchableOpacity>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!page) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        edges={['top']}
      >
        <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connect Page</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: theme.colors.textSecondary }]}>
            Page not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const ownerName = typeof page.userId === 'object' ? page.userId.fullName : '';

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={isTablet ? 28 : 24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          {page.name}
        </Text>
        {isOwner ? (
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => {
              Alert.alert(
                'Page Options',
                undefined,
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete Page',
                    style: 'destructive',
                    onPress: handleDeletePage,
                  },
                ]
              );
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-horizontal" size={isTablet ? 26 : 22} color={theme.colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerRight} />
        )}
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        {page.bannerImage ? (
          <Image
            source={{ uri: optimizeCloudinaryUrl(page.bannerImage, { width: 800, height: 300, quality: 'auto' }) }}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.bannerPlaceholder, { backgroundColor: theme.colors.border + '40' }]}>
            <Ionicons name="image-outline" size={32} color={theme.colors.textSecondary + '60'} />
          </View>
        )}

        {/* Profile Section */}
        <View style={[styles.profileSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.profileRow}>
            {page.profileImage ? (
              <Image source={{ uri: optimizeCloudinaryUrl(page.profileImage, { width: 128, height: 128 }) }} style={styles.pageProfileImage} />
            ) : (
              <View style={[styles.pageProfileImagePlaceholder, { backgroundColor: theme.colors.border }]}>
                <Ionicons name="people" size={32} color={theme.colors.textSecondary} />
              </View>
            )}
            <View style={styles.profileInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {page.type === 'private' && (
                  <Ionicons name="lock-closed" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                )}
                <Text style={[styles.pageName, { color: theme.colors.text }]}>{page.name}</Text>
              </View>
              {ownerName ? (
                <Text style={[styles.ownerLabel, { color: theme.colors.textSecondary }]}>
                  by {ownerName}
                </Text>
              ) : null}
            </View>
          </View>

          {page.bio ? (
            <Text style={[styles.pageBio, { color: theme.colors.textSecondary }]}>
              {page.bio}
            </Text>
          ) : null}

          {/* Stats & Actions Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.statsButton, { backgroundColor: theme.colors.background }]}
              onPress={handleShowFollowers}
              activeOpacity={0.7}
            >
              <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
              <Text style={[styles.statsButtonText, { color: theme.colors.primary }]}>
                Members ({(page.followerCount || 0) + 1})
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity
                style={[styles.statsButton, { backgroundColor: theme.colors.background }]}
                onPress={() => router.push(`/connect/dashboard?pageId=${id}`)}
                activeOpacity={0.7}
              >
                <Ionicons name="analytics-outline" size={18} color={theme.colors.primary} />
                <Text style={[styles.statsButtonText, { color: theme.colors.primary }]}>
                  Dashboard
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Follow Button (non-owner) */}
          {!isOwner && (
            <TouchableOpacity
              style={[
                styles.followMainButton,
                isFollowing
                  ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }
                  : { backgroundColor: theme.colors.primary },
              ]}
              onPress={handleFollowToggle}
              disabled={followLoading}
              activeOpacity={0.7}
            >
              {followLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? theme.colors.text : '#FFFFFF'} />
              ) : (
                <Text
                  style={[
                    styles.followMainButtonText,
                    { color: isFollowing ? theme.colors.text : '#FFFFFF' },
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Website Section */}
        {page.features?.website && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="globe-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Website</Text>
              </View>
              <View style={styles.sectionActions}>
                {page.websiteContent && page.websiteContent.length > 0 && (
                  <TouchableOpacity
                    onPress={() => router.push(`/connect/preview?pageId=${id}&section=website&pageName=${encodeURIComponent(page.name)}`)}
                    activeOpacity={0.7}
                    style={styles.sectionActionButton}
                  >
                    <Ionicons name="eye-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
                {isOwner && (
                  <TouchableOpacity
                    onPress={() => router.push(`/connect/editContent?pageId=${id}&section=website`)}
                    activeOpacity={0.7}
                    style={styles.sectionActionButton}
                  >
                    <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.sectionContent}>
              {page.websiteContent && page.websiteContent.length > 0 ? (
                page.websiteContent
                  .sort((a, b) => a.order - b.order)
                  .slice(0, 2)
                  .map((block, idx) => renderContentBlock(block, idx))
              ) : (
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  {isOwner ? 'Tap the edit icon to add content to your website.' : 'No content yet.'}
                </Text>
              )}
              {page.websiteContent && page.websiteContent.length > 2 && (
                <TouchableOpacity
                  onPress={() => router.push(`/connect/preview?pageId=${id}&section=website&pageName=${encodeURIComponent(page.name)}`)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.viewMoreText, { color: theme.colors.primary }]}>
                    View all ({page.websiteContent.length} items)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Group Chat Section */}
        {page.features?.groupChat && (
          <TouchableOpacity
            style={[styles.section, { backgroundColor: theme.colors.surface }]}
            onPress={handleOpenChat}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="chatbubbles-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Group Chat</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
            </View>
            <Text style={[styles.chatDescription, { color: theme.colors.textSecondary }]}>
              Join the conversation with {(page.followerCount || 0) + 1} members
            </Text>
          </TouchableOpacity>
        )}

        {/* Subscription Section */}
        {page.features?.subscription && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="star-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Subscription</Text>
              </View>
              {isOwner && (
                <TouchableOpacity
                  onPress={() => router.push(`/connect/editContent?pageId=${id}&section=subscription`)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.sectionContent}>
              {page.subscriptionContent && page.subscriptionContent.length > 0 ? (
                page.subscriptionContent
                  .sort((a, b) => a.order - b.order)
                  .map((block, idx) => renderContentBlock(block, idx))
              ) : (
                <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
                  {isOwner ? 'Tap the edit icon to list your services.' : 'No services listed yet.'}
                </Text>
              )}
            </View>
            {/* Subscribe button — Coming Soon for Phase 1 */}
            {!isOwner && page.subscriptionContent && page.subscriptionContent.length > 0 && (
              <TouchableOpacity
                style={[styles.subscribeButton, { backgroundColor: theme.colors.border }]}
                onPress={() => Alert.alert('Coming Soon', 'Subscription payments will be available in a future update.')}
                activeOpacity={0.7}
              >
                <Text style={[styles.subscribeButtonText, { color: theme.colors.textSecondary }]}>
                  Subscribe — Coming Soon
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Buy Items Section (Admin pages only) */}
        {page.isAdminPage && page.buyItems && page.buyItems.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="cart-outline" size={20} color={theme.colors.primary} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Buy</Text>
              </View>
            </View>
            {page.buyItems
              .filter(item => item.active)
              .map((item, idx) => (
                <View
                  key={item._id || idx}
                  style={[styles.buyItem, { borderBottomColor: theme.colors.border }]}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.buyItemImage} />
                  ) : null}
                  <View style={styles.buyItemInfo}>
                    <Text style={[styles.buyItemName, { color: theme.colors.text }]}>{item.name}</Text>
                    <Text style={[styles.buyItemDesc, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                      {item.description}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.buyButton, { backgroundColor: theme.colors.border }]}
                    onPress={() => Alert.alert('Coming Soon', 'Payments will be available in a future update.')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.buyButtonText, { color: theme.colors.textSecondary }]}>
                      Buy
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
          </View>
        )}

        {/* Delete Page — Owner only */}
        {isOwner && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePage}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            <Text style={styles.deleteButtonText}>Delete Page</Text>
          </TouchableOpacity>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Followers Modal */}
      <Modal
        visible={showFollowers}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFollowers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.surface }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Members
              </Text>
              <TouchableOpacity
                onPress={() => setShowFollowers(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>

            {followersLoading ? (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
              </View>
            ) : followers.length === 0 ? (
              <View style={styles.modalLoading}>
                <Text style={{ color: theme.colors.textSecondary }}>No members yet</Text>
              </View>
            ) : (
              <FlatList
                data={followers}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.followerItem}
                    onPress={() => {
                      setShowFollowers(false);
                      router.push(`/profile/${item._id}`);
                    }}
                    activeOpacity={0.7}
                  >
                    {item.profilePic ? (
                      <Image source={{ uri: item.profilePic }} style={styles.followerAvatar} />
                    ) : (
                      <View style={[styles.followerAvatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                        <Ionicons name="person" size={20} color={theme.colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.followerInfo}>
                      <View style={styles.followerNameRow}>
                        <Text style={[styles.followerName, { color: theme.colors.text }]} numberOfLines={1}>
                          {item.fullName}
                        </Text>
                        {item.role === 'admin' && (
                          <View style={[styles.adminBadge, { backgroundColor: theme.colors.primary + '18' }]}>
                            <Text style={[styles.adminBadgeText, { color: theme.colors.primary }]}>Admin</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.followerUsername, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                contentContainerStyle={{ paddingBottom: 20 }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(isWeb && {
      maxWidth: isTablet ? 1000 : 800,
      alignSelf: 'center',
      width: '100%',
    } as any),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerImage: {
    width: '100%',
    height: isTablet ? 220 : 160,
  },
  bannerPlaceholder: {
    width: '100%',
    height: isTablet ? 220 : 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingVertical: isTablet ? themeConstants.spacing.md : 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  headerRight: {
    width: isTablet ? 48 : 40,
    alignItems: 'flex-end',
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  // Profile Section
  profileSection: {
    margin: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    borderRadius: themeConstants.borderRadius.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pageProfileImage: {
    width: isTablet ? 72 : 64,
    height: isTablet ? 72 : 64,
    borderRadius: isTablet ? 36 : 32,
    marginRight: isTablet ? themeConstants.spacing.md : 12,
  },
  pageProfileImagePlaceholder: {
    width: isTablet ? 72 : 64,
    height: isTablet ? 72 : 64,
    borderRadius: isTablet ? 36 : 32,
    marginRight: isTablet ? themeConstants.spacing.md : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  pageName: {
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  ownerLabel: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  pageBio: {
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    lineHeight: isTablet ? 22 : 20,
    marginBottom: 16,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  statsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: themeConstants.borderRadius.sm,
  },
  statsButtonText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  followMainButton: {
    paddingVertical: 12,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followMainButtonText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  // Sections
  section: {
    marginHorizontal: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    marginBottom: isTablet ? themeConstants.spacing.md : themeConstants.spacing.sm,
    padding: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
    borderRadius: themeConstants.borderRadius.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionActionButton: {
    padding: 4,
  },
  sectionContent: {
    gap: 12,
  },
  viewMoreText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  // Content blocks
  contentHeading: {
    fontSize: isTablet ? 20 : 18,
    lineHeight: isTablet ? 28 : 24,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  contentText: {
    fontSize: isTablet ? 15 : 14,
    lineHeight: isTablet ? 22 : 20,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  contentImage: {
    width: '100%',
    height: 200,
    borderRadius: themeConstants.borderRadius.sm,
  },
  videoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: themeConstants.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  // Chat
  chatDescription: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    fontWeight: '400',
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  // Subscribe
  subscribeButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
  },
  subscribeButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Buy Items
  buyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  buyItemImage: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: themeConstants.borderRadius.sm,
    marginRight: 12,
  },
  buyItemInfo: {
    flex: 1,
    marginRight: 12,
  },
  buyItemName: {
    fontSize: isTablet ? 15 : 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  buyItemDesc: {
    fontSize: isTablet ? 13 : 12,
    lineHeight: 18,
  },
  buyButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: themeConstants.borderRadius.sm,
  },
  buyButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginTop: isTablet ? 24 : 16,
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 1,
    borderColor: '#FF3B3020',
    backgroundColor: '#FF3B3008',
  },
  deleteButtonText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    color: '#FF3B30',
  },
  // Followers Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    maxHeight: '70%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
  },
  modalLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  followerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  followerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followerInfo: {
    flex: 1,
    gap: 2,
  },
  followerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  followerName: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    flexShrink: 1,
  },
  adminBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  adminBadgeText: {
    fontSize: 11,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  followerUsername: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
  },
});

