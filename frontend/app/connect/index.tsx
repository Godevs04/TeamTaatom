import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import ConnectCard from '../../components/ConnectCard';
import EmptyState from '../../components/EmptyState';
import {
  getMyPages,
  getCommunities,
  followConnectPage,
  unfollowConnectPage,
  findUsers,
  getCountries,
  getLanguages,
  ConnectPageType,
  GeoItem,
} from '../../services/connect';
import { toggleFollow } from '../../services/profile';
import logger from '../../utils/logger';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

type TabType = 'connect' | 'community' | 'find';

interface FoundUser {
  _id: string;
  username: string;
  fullName: string;
  profilePic: string;
  bio: string;
  language: string;
  isFollowing: boolean;
}

export default function ConnectHubScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('connect');

  // Page list state (Archived + Community tabs)
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pages, setPages] = useState<ConnectPageType[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Connect tab state (my created pages)
  const [myPages, setMyPages] = useState<ConnectPageType[]>([]);
  const [myPagesLoading, setMyPagesLoading] = useState(false);

  // Bottom sheet state (Find tab user popup)
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [showUserSheet, setShowUserSheet] = useState(false);

  // Find tab state
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [languages, setLanguages] = useState<GeoItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [findSearched, setFindSearched] = useState(false);
  const [geoLoaded, setGeoLoaded] = useState(false);

  // Load countries/languages for Find tab
  useEffect(() => {
    if (!geoLoaded) {
      Promise.all([getCountries(), getLanguages()])
        .then(([c, l]) => {
          setCountries(c.countries);
          setLanguages(l.languages);
          setGeoLoaded(true);
        })
        .catch(err => logger.error('Error loading geo data:', err));
    }
  }, [geoLoaded]);

  // Fetch my created pages (Connect tab)
  const fetchMyPages = useCallback(async () => {
    try {
      setMyPagesLoading(true);
      const response = await getMyPages();
      setMyPages(response.pages);
    } catch (error) {
      logger.error('Error fetching my pages:', error);
    } finally {
      setMyPagesLoading(false);
    }
  }, []);

  // Fetch pages for Community tab
  const fetchPages = useCallback(async (pNum = 1, isRefresh = false) => {
    if (activeTab !== 'community') return;
    try {
      if (pNum === 1) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      }
      const response = await getCommunities(pNum, 20);
      if (response) {
        if (pNum === 1) setPages(response.pages);
        else setPages(prev => [...prev, ...response.pages]);
        setHasMore(response.pagination.page < response.pagination.totalPages);
        setPageNum(pNum);
      }
    } catch (error) {
      logger.error('Error fetching connect pages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'connect') fetchMyPages();
      else if (activeTab === 'community') fetchPages(1);
    }, [fetchMyPages, fetchPages, activeTab])
  );

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'community') {
      setPages([]);
      setPageNum(1);
      setHasMore(true);
      setLoading(true);
    }
  };

  // Find tab: search users
  const handleFindUsers = async () => {
    if (!selectedLanguage) return;
    try {
      setFindLoading(true);
      const response = await findUsers({
        target_country: selectedCountry || undefined,
        lang: selectedLanguage,
        page: 1,
        limit: 30,
      });
      setFoundUsers(response.users);
      setFindSearched(true);
    } catch (error) {
      logger.error('Error finding users:', error);
    } finally {
      setFindLoading(false);
    }
  };

  // Find tab: toggle profile follow
  const handleProfileFollowToggle = async (user: FoundUser) => {
    try {
      const wasFollowing = user.isFollowing;
      setFoundUsers(prev =>
        prev.map(u => (u._id === user._id ? { ...u, isFollowing: !wasFollowing } : u))
      );
      await toggleFollow(user._id);
    } catch (error) {
      setFoundUsers(prev =>
        prev.map(u => (u._id === user._id ? { ...u, isFollowing: user.isFollowing } : u))
      );
      logger.error('Error toggling profile follow:', error);
    }
  };

  // Page follow toggle (Archived/Community tabs)
  const handlePageFollowToggle = async (pageItem: ConnectPageType) => {
    try {
      const wasFollowing = pageItem.isFollowing;
      setPages(prev =>
        prev.map(p =>
          p._id === pageItem._id
            ? { ...p, isFollowing: !wasFollowing, followerCount: p.followerCount + (wasFollowing ? -1 : 1) }
            : p
        )
      );
      if (wasFollowing) await unfollowConnectPage(pageItem._id);
      else await followConnectPage(pageItem._id);
    } catch (error) {
      setPages(prev =>
        prev.map(p =>
          p._id === pageItem._id
            ? { ...p, isFollowing: pageItem.isFollowing, followerCount: pageItem.followerCount }
            : p
        )
      );
      logger.error('Error toggling follow:', error);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading && activeTab === 'community') {
      setLoadingMore(true);
      fetchPages(pageNum + 1);
    }
  };

  const renderPageItem = ({ item }: { item: ConnectPageType }) => (
    <ConnectCard
      page={item}
      onPress={() => router.push(`/connect/page/${item._id}`)}
      onFollowPress={() => handlePageFollowToggle(item)}
      isFollowing={item.isFollowing}
      showFollowButton={activeTab === 'community'}
    />
  );

  const renderUserItem = (user: FoundUser) => (
    <TouchableOpacity
      key={user._id}
      style={[styles.userCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => { setSelectedUser(user); setShowUserSheet(true); }}
      activeOpacity={0.7}
    >
      <View style={styles.userCardContent}>
        {user.profilePic ? (
          <Image source={{ uri: user.profilePic }} style={styles.userAvatar} />
        ) : (
          <View style={[styles.userAvatarPlaceholder, { backgroundColor: theme.colors.border }]}>
            <Ionicons name="person" size={22} color={theme.colors.textSecondary} />
          </View>
        )}
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.colors.text }]} numberOfLines={1}>
            {user.fullName}
          </Text>
          <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            @{user.username}
          </Text>
          {user.bio ? (
            <Text style={[styles.userBio, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {user.bio}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={[
            styles.followBtn,
            user.isFollowing
              ? { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1 }
              : { backgroundColor: theme.colors.primary },
          ]}
          onPress={() => handleProfileFollowToggle(user)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.followBtnText, { color: user.isFollowing ? theme.colors.text : '#FFFFFF' }]}>
            {user.isFollowing ? 'Following' : 'Follow'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const getSelectedLabel = (items: GeoItem[], code: string, placeholder: string) => {
    if (!code) return placeholder;
    const item = items.find(i => i.code === code);
    return item ? item.name : placeholder;
  };

  const renderPickerModal = (
    visible: boolean,
    items: GeoItem[],
    selected: string,
    onSelect: (code: string) => void,
    onClose: () => void,
    title: string
  ) => {
    if (!visible) return null;
    return (
      <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.pickerModal, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.pickerHeader}>
            <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.pickerItem, !selected && { backgroundColor: theme.colors.primary + '15' }]}
              onPress={() => { onSelect(''); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, { color: !selected ? theme.colors.primary : theme.colors.textSecondary }]}>
                Any
              </Text>
            </TouchableOpacity>
            {items.map(item => (
              <TouchableOpacity
                key={item.code}
                style={[styles.pickerItem, selected === item.code && { backgroundColor: theme.colors.primary + '15' }]}
                onPress={() => { onSelect(item.code); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerItemText, { color: selected === item.code ? theme.colors.primary : theme.colors.text }]}>
                  {item.name}
                </Text>
                {selected === item.code && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  // Connect tab — user's own created pages
  const renderConnectTab = () => {
    if (myPagesLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (myPages.length === 0) {
      return (
        <EmptyState
          icon="add-circle-outline"
          title="No pages yet"
          description="Create your first Connect page to share with the community."
        />
      );
    }

    return (
      <FlashList
        data={myPages}
        renderItem={({ item }: { item: ConnectPageType }) => (
          <ConnectCard
            page={item}
            onPress={() => router.push(`/connect/page/${item._id}`)}
            onFollowPress={() => {}}
            isFollowing={false}
            showFollowButton={false}
          />
        )}
        estimatedItemSize={100}
        keyExtractor={(item: ConnectPageType) => item._id}
        contentContainerStyle={{ padding: isTablet ? themeConstants.spacing.md : 8 } as any}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchMyPages().finally(() => setRefreshing(false)); }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    );
  };

  // Bottom sheet for Find tab user actions
  const renderUserBottomSheet = () => {
    if (!showUserSheet || !selectedUser) return null;
    return (
      <TouchableOpacity
        style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
        activeOpacity={1}
        onPress={() => setShowUserSheet(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.userSheet, { backgroundColor: theme.colors.surface }]}
          onPress={() => {}}
        >
          {/* User Info Header */}
          <View style={styles.sheetUserHeader}>
            {selectedUser.profilePic ? (
              <Image source={{ uri: selectedUser.profilePic }} style={styles.sheetAvatar} />
            ) : (
              <View style={[styles.sheetAvatarPlaceholder, { backgroundColor: theme.colors.border }]}>
                <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
              </View>
            )}
            <View style={styles.sheetUserInfo}>
              <Text style={[styles.sheetUserName, { color: theme.colors.text }]} numberOfLines={1}>
                {selectedUser.fullName}
              </Text>
              <Text style={[styles.sheetUsername, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                @{selectedUser.username}
              </Text>
            </View>
          </View>

          {selectedUser.bio ? (
            <Text style={[styles.sheetBio, { color: theme.colors.textSecondary }]} numberOfLines={3}>
              {selectedUser.bio}
            </Text>
          ) : null}

          {/* Action Buttons */}
          <TouchableOpacity
            style={[styles.sheetAction, { borderBottomColor: theme.colors.border }]}
            onPress={() => { setShowUserSheet(false); router.push(`/profile/${selectedUser._id}`); }}
            activeOpacity={0.7}
          >
            <Ionicons name="person-outline" size={22} color={theme.colors.text} />
            <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>View Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetAction, { borderBottomColor: theme.colors.border }]}
            onPress={() => {
              const user = selectedUser;
              setShowUserSheet(false);
              handleProfileFollowToggle(user);
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name={selectedUser.isFollowing ? 'person-remove-outline' : 'person-add-outline'}
              size={22}
              color={selectedUser.isFollowing ? theme.colors.error : theme.colors.primary}
            />
            <Text style={[styles.sheetActionText, { color: selectedUser.isFollowing ? theme.colors.error : theme.colors.primary }]}>
              {selectedUser.isFollowing ? 'Unfollow' : 'Follow'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sheetAction, { borderBottomColor: theme.colors.border }]}
            onPress={() => { setShowUserSheet(false); router.push(`/chat?userId=${selectedUser._id}`); }}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={22} color={theme.colors.text} />
            <Text style={[styles.sheetActionText, { color: theme.colors.text }]}>Message</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={() => setShowUserSheet(false)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sheetCancelText, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderFindTab = () => (
    <ScrollView
      style={styles.findContainer}
      contentContainerStyle={styles.findContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Filter Form */}
      <View style={[styles.filterCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
          Find Fellow Travelers
        </Text>
        <Text style={[styles.filterSubtitle, { color: theme.colors.textSecondary }]}>
          Discover travelers who speak your language
        </Text>

        {/* Country Picker */}
        <TouchableOpacity
          style={[styles.filterSelect, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={() => setShowCountryPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={[styles.filterSelectText, { color: selectedCountry ? theme.colors.text : theme.colors.textSecondary }]}>
            {getSelectedLabel(countries, selectedCountry, 'Select Country (optional)')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Language Picker */}
        <TouchableOpacity
          style={[styles.filterSelect, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
          onPress={() => setShowLanguagePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="language-outline" size={18} color={theme.colors.textSecondary} />
          <Text style={[styles.filterSelectText, { color: selectedLanguage ? theme.colors.text : theme.colors.textSecondary }]}>
            {getSelectedLabel(languages, selectedLanguage, 'Select Language *')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={theme.colors.textSecondary} />
        </TouchableOpacity>

        {/* Search Button */}
        <TouchableOpacity
          style={[styles.findButton, { backgroundColor: theme.colors.primary, opacity: !selectedLanguage || findLoading ? 0.5 : 1 }]}
          onPress={handleFindUsers}
          disabled={!selectedLanguage || findLoading}
          activeOpacity={0.7}
        >
          {findLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="search" size={18} color="#FFFFFF" />
              <Text style={styles.findButtonText}>Find Travelers</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* User Results */}
      {findSearched && foundUsers.length === 0 && (
        <View style={styles.findEmptyContainer}>
          <Ionicons name="people-outline" size={48} color={theme.colors.textSecondary + '40'} />
          <Text style={[styles.findEmptyText, { color: theme.colors.textSecondary }]}>
            No travelers found with these filters. Try different options.
          </Text>
        </View>
      )}

      {foundUsers.map(user => renderUserItem(user))}
    </ScrollView>
  );

  const renderPageListTab = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (pages.length === 0) {
      return <EmptyState icon="globe-outline" title="No communities yet" description="Community pages created by admins will appear here." />;
    }

    return (
      <FlashList
        data={pages}
        renderItem={renderPageItem}
        estimatedItemSize={100}
        keyExtractor={(item: ConnectPageType) => item._id}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPages(1, true)}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    );
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'connect', label: 'Connect' },
    { key: 'community', label: 'Community' },
    { key: 'find', label: 'Find' },
  ];

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
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Connect</Text>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => router.push('/connect/search')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="search" size={isTablet ? 26 : 22} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 }]}
              onPress={() => handleTabChange(tab.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[styles.tabText, { color: isActive ? theme.colors.primary : theme.colors.textSecondary }, isActive && styles.tabTextActive]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab Content */}
      {activeTab === 'connect' ? renderConnectTab() : activeTab === 'find' ? renderFindTab() : renderPageListTab()}

      {/* FAB — Create Connect Page */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/connect/create')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* User Bottom Sheet (Find tab) */}
      {renderUserBottomSheet()}

      {/* Picker Modals */}
      {renderPickerModal(showCountryPicker, countries, selectedCountry, setSelectedCountry, () => setShowCountryPicker(false), 'Select Country')}
      {renderPickerModal(showLanguagePicker, languages, selectedLanguage, setSelectedLanguage, () => setShowLanguagePicker(false), 'Select Language')}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  searchButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: isTablet ? 14 : 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: isTablet ? 16 : 14,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: isTablet ? 32 : 20,
    bottom: isTablet ? 32 : 20,
    width: isTablet ? 60 : 56,
    height: isTablet ? 60 : 56,
    borderRadius: isTablet ? 30 : 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  // Find Tab
  findContainer: {
    flex: 1,
  },
  findContent: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingBottom: 80,
  },
  filterCard: {
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 1,
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
    marginBottom: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
  },
  filterTitle: {
    fontSize: isTablet ? 20 : 18,
    fontFamily: getFontFamily('700'),
    fontWeight: '700',
    marginBottom: 4,
  },
  filterSubtitle: {
    fontSize: isTablet ? 14 : 13,
    marginBottom: 20,
  },
  filterSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    paddingHorizontal: 14,
    paddingVertical: isTablet ? 14 : 12,
    marginBottom: 12,
    gap: 10,
  },
  filterSelectText: {
    flex: 1,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: isTablet ? 14 : 12,
    borderRadius: themeConstants.borderRadius.sm,
    marginTop: 4,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  findEmptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  findEmptyText: {
    fontSize: 15,
    textAlign: 'center',
    maxWidth: 280,
  },
  // User Card (Find tab results)
  userCard: {
    borderRadius: themeConstants.borderRadius.md,
    borderWidth: 1,
    marginBottom: isTablet ? themeConstants.spacing.md : themeConstants.spacing.sm,
    padding: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: isTablet ? 52 : 44,
    height: isTablet ? 52 : 44,
    borderRadius: isTablet ? 26 : 22,
    marginRight: 12,
  },
  userAvatarPlaceholder: {
    width: isTablet ? 52 : 44,
    height: isTablet ? 52 : 44,
    borderRadius: isTablet ? 26 : 22,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  userName: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 1,
  },
  userUsername: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginBottom: 2,
  },
  userBio: {
    fontSize: isTablet ? 13 : 12,
    lineHeight: 16,
  },
  followBtn: {
    paddingHorizontal: isTablet ? 16 : 14,
    paddingVertical: isTablet ? 8 : 6,
    borderRadius: themeConstants.borderRadius.sm,
    alignItems: 'center',
  },
  followBtnText: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  // Picker Modal
  pickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  pickerModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 30,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  pickerTitle: {
    fontSize: 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  pickerList: {
    paddingHorizontal: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    marginVertical: 1,
  },
  pickerItemText: {
    fontSize: 16,
    fontFamily: getFontFamily('400'),
  },
  // User Bottom Sheet
  userSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 30,
    paddingTop: 8,
  },
  sheetUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sheetAvatar: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    marginRight: 14,
  },
  sheetAvatarPlaceholder: {
    width: isTablet ? 56 : 48,
    height: isTablet ? 56 : 48,
    borderRadius: isTablet ? 28 : 24,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetUserInfo: {
    flex: 1,
  },
  sheetUserName: {
    fontSize: isTablet ? 18 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  sheetUsername: {
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
    marginTop: 2,
  },
  sheetBio: {
    fontSize: isTablet ? 14 : 13,
    lineHeight: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: isTablet ? 16 : 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetActionText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 14,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: isTablet ? 16 : 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
});
