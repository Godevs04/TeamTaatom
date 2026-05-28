import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Dimensions,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import LoadingGlobe from '../../components/LoadingGlobe';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../../context/ThemeContext';
import { theme as themeConstants } from '../../constants/theme';
import ConnectCard from '../../components/ConnectCard';
import { BlurView } from 'expo-blur';
import EmptyState from '../../components/EmptyState';
import {
  getMyPages,
  getCommunities,
  getConnectPages,
  followConnectPage,
  unfollowConnectPage,
  findUsers,
  getCountries,
  getLanguages,
  ConnectPageType,
  GeoItem,
} from '../../services/connect';
import { getUserFromStorage } from '../../services/auth';
import { getPlaceSuggestions } from '../../utils/locationUtils';
import { toggleFollow } from '../../services/profile';
import logger from '../../utils/logger';
import PremiumScreen from '../../components/ui/PremiumScreen';
import CloudGlassSurface from '../../components/cloud/CloudGlassSurface';
import PremiumIconButton from '../../components/ui/PremiumIconButton';
import PremiumSegmentedTabs from '../../components/ui/PremiumSegmentedTabs';
import GradientText from '../../components/ui/GradientText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

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
  travelStyle?: string;
  isFollowing: boolean;
}

const TRAVEL_STYLES = [
  { code: 'solo', name: 'Solo Traveler' },
  { code: 'couple', name: 'Couple' },
  { code: 'group', name: 'Group' },
  { code: 'backpacker', name: 'Backpacker' },
  { code: 'luxury', name: 'Luxury' },
];

// Pulled out of the screen body so its `useState` for the search input
// resets every time the modal mounts (i.e. each time a picker is opened).
function PickerModal({
  items,
  selected,
  onSelect,
  onClose,
  title,
  theme,
}: {
  items: GeoItem[];
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  title: string;
  theme: any;
}) {
  const [query, setQuery] = useState('');
  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? items.filter(item =>
        item.name.toLowerCase().includes(trimmed) ||
        item.code.toLowerCase().includes(trimmed)
      )
    : items;

  return (
    <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      <View style={[styles.pickerModal, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.pickerHeader}>
          <Text style={[styles.pickerTitle, { color: theme.colors.text }]}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search input */}
        <View style={[styles.pickerSearchWrap, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
          <Ionicons name="search" size={16} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.pickerSearchInput, { color: theme.colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Type to search…"
            placeholderTextColor={theme.colors.textSecondary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.pickerList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* "Any" option always visible (only when not searching) */}
          {!trimmed && (
            <TouchableOpacity
              style={[styles.pickerItem, !selected && { backgroundColor: theme.colors.primary + '15' }]}
              onPress={() => { onSelect(''); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, { color: !selected ? theme.colors.primary : theme.colors.textSecondary }]}>
                Any
              </Text>
            </TouchableOpacity>
          )}
          {filtered.map(item => (
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
          {trimmed && filtered.length === 0 && (
            <View style={styles.pickerEmpty}>
              <Text style={[styles.pickerItemText, { color: theme.colors.textSecondary }]}>
                No matches
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

export default function ConnectHubScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = isWeb ? 56 : (56 + (insets.top || 0));
  const [activeTab, setActiveTab] = useState<TabType>('connect');

  // Page list state (Archived + Community tabs)
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pages, setPages] = useState<ConnectPageType[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Connect tab state. `myPages` holds every user-created (non-admin) page;
  // the backend orders followed entries first GLOBALLY across the whole
  // collection (not just per fetched batch). `ownedPageIds` remembers which
  // entries were created by the current user so the card hides the Follow
  // button on those.
  const [myPages, setMyPages] = useState<ConnectPageType[]>([]);
  const [myPagesLoading, setMyPagesLoading] = useState(false);
  const [ownedPageIds, setOwnedPageIds] = useState<Set<string>>(new Set());
  const [connectPageNum, setConnectPageNum] = useState(1);
  const [connectHasMore, setConnectHasMore] = useState(true);
  const [connectLoadingMore, setConnectLoadingMore] = useState(false);
  const [connectRefreshing, setConnectRefreshing] = useState(false);

  // Bottom sheet state (Find tab user popup)
  const [selectedUser, setSelectedUser] = useState<FoundUser | null>(null);
  const [showUserSheet, setShowUserSheet] = useState(false);

  // Find tab state
  const [countries, setCountries] = useState<GeoItem[]>([]);
  const [languages, setLanguages] = useState<GeoItem[]>([]);
  // selectedCountry holds the *target* (people-from) country — the variable
  // name is kept to minimize churn; the request param is `target_country`.
  const [selectedCountry, setSelectedCountry] = useState<string>('');
  const [selectedCurrentCountry, setSelectedCurrentCountry] = useState<string>('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedTravelStyle, setSelectedTravelStyle] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCurrentCountryPicker, setShowCurrentCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showTravelStylePicker, setShowTravelStylePicker] = useState(false);
  const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [findSearched, setFindSearched] = useState(false);
  const [geoLoaded, setGeoLoaded] = useState(false);

  // User's own current location — text input + Google Places autocomplete.
  // Stored as a free-form string (place name); not gated by the country list.
  const [userLocation, setUserLocation] = useState<string>('');
  const [userLocationInput, setUserLocationInput] = useState<string>('');
  const [userLocationSuggestions, setUserLocationSuggestions] = useState<string[]>([]);
  const [loadingUserLocation, setLoadingUserLocation] = useState(false);
  const userLocationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load countries/languages for Find tab and pre-populate from profile
  useEffect(() => {
    if (!geoLoaded) {
      Promise.all([getCountries(), getLanguages(), getUserFromStorage()])
        .then(([c, l, u]) => {
          setCountries(c.countries);
          setLanguages(l.languages);
          setGeoLoaded(true);

          if (u) {
            let initialLang = '';
            let initialCountry = '';
            let initialTravelStyle = '';

            // Find user's first language code matching user's languagesKnown
            if (u.languagesKnown && u.languagesKnown.length > 0) {
              const userLang = u.languagesKnown[0].toLowerCase();
              const matchedLang = l.languages.find(
                (item: any) =>
                  item.code.toLowerCase() === userLang ||
                  item.name.toLowerCase() === userLang
              );
              if (matchedLang) {
                setSelectedLanguage(matchedLang.code);
                initialLang = matchedLang.code;
              }
            }

            // Find user's nationality code
            if (u.nationality) {
              const userNationality = u.nationality.toLowerCase();
              const matchedCountry = c.countries.find(
                (item: any) =>
                  item.code.toLowerCase() === userNationality ||
                  item.name.toLowerCase() === userNationality
              );
              if (matchedCountry) {
                setSelectedCountry(matchedCountry.code);
                initialCountry = matchedCountry.code;
              }
            }

            // Travel style pre-population
            if (u.travelStyle) {
              const matchedStyle = TRAVEL_STYLES.find(
                (s) => s.code.toLowerCase() === u.travelStyle?.toLowerCase()
              );
              if (matchedStyle) {
                setSelectedTravelStyle(matchedStyle.code);
                initialTravelStyle = matchedStyle.code;
              }
            }

            // If we have a language, automatically trigger search so they aren't greeted by an empty state
            if (initialLang) {
              setFindLoading(true);
              findUsers({
                target_country: initialCountry || undefined,
                lang: initialLang,
                travel_style: initialTravelStyle || undefined,
                page: 1,
                limit: 30,
              })
                .then(response => {
                  setFoundUsers(response.users);
                  setFindSearched(true);
                })
                .catch(err => {
                  logger.error('Error auto-finding users:', err);
                })
                .finally(() => {
                  setFindLoading(false);
                });
            }
          }
        })
        .catch(err => {
          logger.error('Error loading geo and user data:', err);
          setGeoLoaded(true); // mark done so we don't retry in a loop
        });
    }
  }, [geoLoaded]);

  // Fetch the Connect tab list — every user-created (non-admin) page on the
  // platform. The backend ranks followed entries first across the whole
  // collection, so pagination just appends successive batches. `/my-pages`
  // is fetched alongside the first batch only, purely to mark which entries
  // belong to the current user (so we can hide the Follow button on them).
  const fetchMyPages = useCallback(async (pNum = 1, isRefresh = false) => {
    try {
      if (pNum === 1) {
        if (isRefresh) setConnectRefreshing(true);
        else setMyPagesLoading(true);
      } else {
        setConnectLoadingMore(true);
      }

      if (pNum === 1) {
        const [allRes, mineRes] = await Promise.all([
          getConnectPages(1, 20),
          getMyPages().catch((e) => { logger.error('getMyPages failed:', e); return { pages: [] }; }),
        ]);
        setMyPages(allRes.pages || []);
        setOwnedPageIds(new Set((mineRes.pages || []).map((p) => p._id)));
        setConnectHasMore(allRes.pagination.page < allRes.pagination.totalPages);
        setConnectPageNum(1);
      } else {
        const allRes = await getConnectPages(pNum, 20);
        setMyPages((prev) => [...prev, ...(allRes.pages || [])]);
        setConnectHasMore(allRes.pagination.page < allRes.pagination.totalPages);
        setConnectPageNum(pNum);
      }
    } catch (error) {
      logger.error('Error fetching connect tab pages:', error);
    } finally {
      setMyPagesLoading(false);
      setConnectRefreshing(false);
      setConnectLoadingMore(false);
    }
  }, []);

  const handleLoadMoreConnect = useCallback(() => {
    if (!connectLoadingMore && connectHasMore && !myPagesLoading) {
      fetchMyPages(connectPageNum + 1);
    }
  }, [connectLoadingMore, connectHasMore, myPagesLoading, connectPageNum, fetchMyPages]);

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
        current_country: selectedCurrentCountry || undefined,
        travel_style: selectedTravelStyle || undefined,
        lang: selectedLanguage,
        page: 1,
        limit: 30,
      });
      setFoundUsers(response.users);
      setFindSearched(true);
    } catch (error: any) {
      logger.error('Error finding users:', error);
      Alert.alert('Error', error?.message || 'Failed to find travelers. Please try again.');
    } finally {
      setFindLoading(false);
    }
  };

  // User's own current location — debounced Places autocomplete.
  const handleUserLocationChange = (text: string) => {
    setUserLocationInput(text);
    // Typing means the previously selected location is no longer authoritative.
    if (userLocation) setUserLocation('');
    if (userLocationDebounceRef.current) clearTimeout(userLocationDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setUserLocationSuggestions([]);
      setLoadingUserLocation(false);
      return;
    }
    setLoadingUserLocation(true);
    userLocationDebounceRef.current = setTimeout(async () => {
      try {
        const suggestions = await getPlaceSuggestions(trimmed);
        setUserLocationSuggestions(suggestions);
      } catch (e) {
        setUserLocationSuggestions([]);
      } finally {
        setLoadingUserLocation(false);
      }
    }, 350);
  };

  const handleUserLocationSelect = (place: string) => {
    setUserLocation(place);
    setUserLocationInput(place);
    setUserLocationSuggestions([]);
    if (userLocationDebounceRef.current) {
      clearTimeout(userLocationDebounceRef.current);
      userLocationDebounceRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (userLocationDebounceRef.current) clearTimeout(userLocationDebounceRef.current);
    };
  }, []);

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
    // Defensive: never POST follow/unfollow against the user's own page.
    // Backend rejects it with "Cannot follow your own page", which surfaced
    // as a confusing toggle error when isOwn / ownedPageIds momentarily
    // weren't in sync with the rendered card.
    if (pageItem.isOwn || ownedPageIds.has(pageItem._id)) return;
    const wasFollowing = pageItem.isFollowing;
    // Optimistic update for both the Community list and the Connect-tab list
    // (they can both contain this page).
    const applyOptimistic = (list: ConnectPageType[]) =>
      list.map((p) =>
        p._id === pageItem._id
          ? { ...p, isFollowing: !wasFollowing, followerCount: p.followerCount + (wasFollowing ? -1 : 1) }
          : p
      );
    const rollback = (list: ConnectPageType[]) =>
      list.map((p) =>
        p._id === pageItem._id
          ? { ...p, isFollowing: pageItem.isFollowing, followerCount: pageItem.followerCount }
          : p
      );
    setPages(applyOptimistic);
    setMyPages(applyOptimistic);
    try {
      if (wasFollowing) await unfollowConnectPage(pageItem._id);
      else await followConnectPage(pageItem._id);
    } catch (error) {
      setPages(rollback);
      setMyPages(rollback);
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
      style={styles.userCardTouchable}
      onPress={() => { setSelectedUser(user); setShowUserSheet(true); }}
      activeOpacity={0.7}
    >
      <CloudGlassSurface style={styles.userCard} contentStyle={styles.userCardContent} borderRadius={18}>
        <LinearGradient
          colors={['#1C73B4', '#50C878']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 2,
            borderRadius: isTablet ? 28 : 24,
            marginRight: 12,
          }}
        >
          {user.profilePic ? (
            <Image source={{ uri: user.profilePic }} style={[styles.userAvatar, { marginRight: 0 }]} />
          ) : (
            <View style={[styles.userAvatarPlaceholder, { marginRight: 0, backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
              <Ionicons name="person" size={22} color={theme.colors.textSecondary} />
            </View>
          )}
        </LinearGradient>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.colors.text }]} numberOfLines={1}>
            {user.fullName}
          </Text>
          <Text style={[styles.userUsername, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            @{user.username}
          </Text>
          {user.travelStyle ? (
            <Text style={[styles.userTravelStyle, { color: theme.colors.primary }]} numberOfLines={1}>
              {TRAVEL_STYLES.find(s => s.code === user.travelStyle)?.name || user.travelStyle}
            </Text>
          ) : null}
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
              ? { backgroundColor: 'rgba(255,255,255,0.1)' }
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
      </CloudGlassSurface>
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
      <PickerModal
        items={items}
        selected={selected}
        onSelect={onSelect}
        onClose={onClose}
        title={title}
        theme={theme}
      />
    );
  };

  // Connect tab — every user-created (non-admin) page on the platform,
  // followed entries first (global ranking from the backend), paginated.
  const renderConnectTab = () => {
    if (myPagesLoading) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
        renderItem={({ item }: { item: ConnectPageType }) => {
          // Trust the backend's isOwn flag first; fall back to the
          // ownedPageIds set populated from getMyPages in case isOwn isn't
          // present (older backend, anonymous fetch path, etc.).
          const isOwned = !!item.isOwn || ownedPageIds.has(item._id);
          return (
            <ConnectCard
              page={item}
              onPress={() => router.push(`/connect/page/${item._id}`)}
              onFollowPress={() => handlePageFollowToggle(item)}
              isFollowing={!!item.isFollowing}
              showFollowButton={!isOwned}
            />
          );
        }}
        keyExtractor={(item: ConnectPageType) => item._id}
        contentContainerStyle={{ padding: isTablet ? themeConstants.spacing.md : 8 } as any}
        onEndReached={handleLoadMoreConnect}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          connectLoadingMore ? (
            <View style={{ paddingVertical: 16, alignItems: 'center' }}>
              <LoadingGlobe color={theme.colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={connectRefreshing}
            onRefresh={() => fetchMyPages(1, true)}
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
            <LinearGradient
              colors={['#1C73B4', '#50C878']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                padding: 2,
                borderRadius: isTablet ? 30 : 26,
                marginRight: 14,
              }}
            >
              {selectedUser.profilePic ? (
                <Image source={{ uri: selectedUser.profilePic }} style={[styles.sheetAvatar, { marginRight: 0 }]} />
              ) : (
                <View style={[styles.sheetAvatarPlaceholder, { marginRight: 0, backgroundColor: isDark ? '#000000' : '#FFFFFF' }]}>
                  <Ionicons name="person" size={28} color={theme.colors.textSecondary} />
                </View>
              )}
            </LinearGradient>
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
      <CloudGlassSurface style={styles.filterCard} contentStyle={styles.filterCardContent} borderRadius={20}>
        <Text style={[styles.filterTitle, { color: theme.colors.text }]}>
          Find Fellow Travelers
        </Text>
        <Text style={[styles.filterSubtitle, { color: isDark ? 'rgba(56, 189, 248, 0.8)' : 'rgba(28, 115, 180, 0.8)' }]}>
          Discover travelers who speak your language
        </Text>

        {/* Your current location (free-form, Places autocomplete) */}
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
          Your current location
        </Text>
        <View style={[styles.filterSelect, { borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)', overflow: 'hidden', position: 'relative' }]}>
          <LinearGradient
            colors={isDark ? ['rgba(28, 115, 180, 0.15)', 'rgba(80, 200, 120, 0.05)'] : ['rgba(28, 115, 180, 0.1)', 'rgba(80, 200, 120, 0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="navigate-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          <TextInput
            style={[styles.filterTextInput, { color: isDark ? '#38BDF8' : '#1C73B4', zIndex: 1 }]}
            value={userLocationInput}
            onChangeText={handleUserLocationChange}
            placeholder="Type a city…"
            placeholderTextColor={isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
          />
          {loadingUserLocation ? (
            <LoadingGlobe size="small" color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          ) : userLocationInput.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setUserLocation('');
                setUserLocationInput('');
                setUserLocationSuggestions([]);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              style={{ zIndex: 1 }}
            >
              <Ionicons name="close-circle" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
            </TouchableOpacity>
          ) : null}
        </View>
        {userLocationSuggestions.length > 0 && !userLocation && (
          <View style={[styles.suggestionsList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
            {userLocationSuggestions.slice(0, 5).map((s, idx) => (
              <TouchableOpacity
                key={`${s}-${idx}`}
                style={[styles.suggestionItem, idx < userLocationSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}
                onPress={() => handleUserLocationSelect(s)}
                activeOpacity={0.6}
              >
                <Ionicons name="location-outline" size={16} color={theme.colors.textSecondary} />
                <Text style={[styles.suggestionText, { color: theme.colors.text }]} numberOfLines={1}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* People-from country */}
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
          Which country&apos;s people would you like to connect with?
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, { borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)', overflow: 'hidden', position: 'relative' }]}
          onPress={() => setShowCountryPicker(true)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={isDark ? ['rgba(28, 115, 180, 0.15)', 'rgba(80, 200, 120, 0.05)'] : ['rgba(28, 115, 180, 0.1)', 'rgba(80, 200, 120, 0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="flag-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          <Text style={[styles.filterSelectText, { color: selectedCountry ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'), zIndex: 1 }]}>
            {getSelectedLabel(countries, selectedCountry, 'Select country (optional)')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
        </TouchableOpacity>

        {/* Where they currently are */}
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
          Which country should they currently be in?
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, { borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)', overflow: 'hidden', position: 'relative' }]}
          onPress={() => setShowCurrentCountryPicker(true)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={isDark ? ['rgba(28, 115, 180, 0.15)', 'rgba(80, 200, 120, 0.05)'] : ['rgba(28, 115, 180, 0.1)', 'rgba(80, 200, 120, 0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="location-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          <Text style={[styles.filterSelectText, { color: selectedCurrentCountry ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'), zIndex: 1 }]}>
            {getSelectedLabel(countries, selectedCurrentCountry, 'Select country (optional)')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
        </TouchableOpacity>

        {/* Language Picker */}
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#38BDF8' : '#1C73B4' }]}>
          Language (required)
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, { borderColor: !selectedLanguage ? (isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(28, 115, 180, 0.4)') : (isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'), overflow: 'hidden', position: 'relative' }]}
          onPress={() => setShowLanguagePicker(true)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={isDark ? ['rgba(28, 115, 180, 0.15)', 'rgba(80, 200, 120, 0.05)'] : ['rgba(28, 115, 180, 0.1)', 'rgba(80, 200, 120, 0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="language-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          <Text style={[styles.filterSelectText, { color: selectedLanguage ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'), zIndex: 1 }]}>
            {getSelectedLabel(languages, selectedLanguage, 'Select Language *')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
        </TouchableOpacity>

        {/* Travel Style Picker */}
        <TouchableOpacity
          style={[styles.filterSelect, { borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)', overflow: 'hidden', position: 'relative' }]}
          onPress={() => setShowTravelStylePicker(true)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={isDark ? ['rgba(28, 115, 180, 0.15)', 'rgba(80, 200, 120, 0.05)'] : ['rgba(28, 115, 180, 0.1)', 'rgba(80, 200, 120, 0.03)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name="compass-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
          <Text style={[styles.filterSelectText, { color: selectedTravelStyle ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'), zIndex: 1 }]}>
            {selectedTravelStyle ? TRAVEL_STYLES.find(s => s.code === selectedTravelStyle)?.name || 'Travel Style' : 'Select Travel Style (optional)'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} style={{ zIndex: 1 }} />
        </TouchableOpacity>

        {/* Search Button */}
        <TouchableOpacity
          style={{ marginTop: 4, opacity: !selectedLanguage || findLoading ? 0.5 : 1 }}
          onPress={handleFindUsers}
          disabled={!selectedLanguage || findLoading}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#1C73B4', '#50C878']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.findButton}
          >
            {findLoading ? (
              <LoadingGlobe size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="search" size={18} color="#FFFFFF" />
                <Text style={styles.findButtonText}>Find Travelers</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </CloudGlassSurface>

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
          <LoadingGlobe size="large" color={theme.colors.primary} />
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
        keyExtractor={(item: ConnectPageType) => item._id}
        contentContainerStyle={{ padding: isTablet ? themeConstants.spacing.md : 8 } as any}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <LoadingGlobe size="small" color={theme.colors.primary} />
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

  const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'connect', label: 'Connect', icon: 'sparkles-outline' },
    { key: 'community', label: 'Community', icon: 'people-outline' },
    { key: 'find', label: 'Find', icon: 'compass-outline' },
  ];

  return (
    <PremiumScreen style={styles.container} edges={[]} hideBackgroundDesign={true}>
      {/* Floating Glass Top Bar */}
      <View
        style={[
          styles.solidTopBar,
          {
            height: topBarHeight,
            paddingTop: topBarHeight - 56,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            borderBottomLeftRadius: 24,
            borderBottomRightRadius: 24,
            overflow: 'hidden',
            borderWidth: 1,
            borderTopWidth: 0,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
            backgroundColor: isDark ? 'rgba(13, 27, 42, 0.65)' : 'rgba(255, 255, 255, 0.65)',
          }
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          colors={isDark ? ['rgba(255, 255, 255, 0.1)', 'transparent'] : ['rgba(255, 255, 255, 0.5)', 'transparent']}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.topBarContent}>
          <PremiumIconButton
            icon="arrow-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
            color={isDark ? '#38BDF8' : '#1C73B4'}
          />
          <GradientText text="Connect" style={styles.topBarTitle} />
          <PremiumIconButton
            icon="search"
            onPress={() => router.push('/connect/search')}
            accessibilityLabel="Search"
            color={isDark ? '#38BDF8' : '#1C73B4'}
          />
        </View>
      </View>

      {/* Tabs & Tab Content wrapper to account for floating absolute top bar */}
      <View style={{ flex: 1, paddingTop: topBarHeight }}>
        {/* Tabs */}
        <PremiumSegmentedTabs tabs={tabs} value={activeTab} onChange={handleTabChange} style={styles.tabBar} />

        {/* Tab Content */}
        {activeTab === 'connect' ? renderConnectTab() : activeTab === 'find' ? renderFindTab() : renderPageListTab()}
      </View>

      {/* FAB — Create Connect Page (Connect tab only) */}
      {activeTab === 'connect' && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: isDark ? '#38BDF8' : '#1C73B4', shadowColor: theme.colors.glowBlue }]}
          onPress={() => router.push('/connect/create')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={isDark ? '#000000' : '#FFFFFF'} />
        </TouchableOpacity>
      )}

      {/* User Bottom Sheet (Find tab) */}
      {renderUserBottomSheet()}

      {/* Picker Modals */}
      {renderPickerModal(showCountryPicker, countries, selectedCountry, setSelectedCountry, () => setShowCountryPicker(false), 'People from')}
      {renderPickerModal(showCurrentCountryPicker, countries, selectedCurrentCountry, setSelectedCurrentCountry, () => setShowCurrentCountryPicker(false), 'Currently in')}
      {renderPickerModal(showLanguagePicker, languages, selectedLanguage, setSelectedLanguage, () => setShowLanguagePicker(false), 'Select Language')}
      {renderPickerModal(showTravelStylePicker, TRAVEL_STYLES, selectedTravelStyle, setSelectedTravelStyle, () => setShowTravelStylePicker(false), 'Select Travel Style')}
    </PremiumScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    paddingTop: isTablet ? themeConstants.spacing.md : 12,
    paddingBottom: 10,
  },
  backButton: {
    padding: isTablet ? themeConstants.spacing.sm : 8,
  },
  headerTitle: {
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
    marginHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
    marginBottom: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.36,
    shadowRadius: 18,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
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
    borderRadius: 30,
    marginBottom: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
  },
  filterCardContent: {
    padding: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.lg,
  },
  filterTitle: {
    fontSize: isTablet ? 17 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
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
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: isTablet ? 14 : 12,
    marginBottom: 12,
    gap: 10,
    shadowColor: '#65BDF7',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  filterSelectText: {
    flex: 1,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
  },
  filterTextInput: {
    flex: 1,
    fontSize: isTablet ? 15 : 14,
    fontFamily: getFontFamily('400'),
    padding: 0,
  },
  filterFieldLabel: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 6,
  },
  suggestionsList: {
    borderWidth: 1,
    borderRadius: themeConstants.borderRadius.sm,
    marginTop: -6,
    marginBottom: 12,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestionText: {
    flex: 1,
    fontSize: isTablet ? 14 : 13,
    fontFamily: getFontFamily('400'),
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: isTablet ? 14 : 12,
    borderRadius: themeConstants.borderRadius.full,
    marginTop: 4,
    shadowColor: '#32A8FF',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  findButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  userCardTouchable: {
    marginBottom: isTablet ? themeConstants.spacing.md : themeConstants.spacing.sm,
  },
  userCard: {
    borderRadius: 26,
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? themeConstants.spacing.lg : themeConstants.spacing.md,
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
    fontSize: 15,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 1,
  },
  userUsername: {
    fontSize: isTablet ? 13 : 12,
    fontFamily: getFontFamily('400'),
    marginBottom: 2,
  },
  userTravelStyle: {
    fontSize: isTablet ? 12 : 11,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
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
    fontSize: 13,
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
    fontSize: 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: getFontFamily('400'),
    padding: 0,
  },
  pickerEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
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
    fontSize: 16,
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
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  sheetCancel: {
    alignItems: 'center',
    paddingVertical: isTablet ? 16 : 14,
    marginTop: 4,
  },
  sheetCancelText: {
    fontSize: 15,
    fontFamily: getFontFamily('500'),
    fontWeight: '500',
  },
  solidTopBar: {
    justifyContent: 'flex-end',
    zIndex: 100,
  },
  topBarContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? themeConstants.spacing.xl : themeConstants.spacing.md,
  },
  topBarTitle: {
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
  },
  topBarShadow: {
    height: 4,
    zIndex: 99,
  },
});
