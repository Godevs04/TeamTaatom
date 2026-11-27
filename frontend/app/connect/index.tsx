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
  KeyboardAvoidingView,
  Modal,
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
import { listEventsFeed, type CommunityEvent } from '../../services/community';
import { getUserFromStorage } from '../../services/auth';
import { getPlaceSuggestions, getStateSuggestions } from '../../utils/locationUtils';
import logger from '../../utils/logger';
import FollowButton, { FollowState } from '../../components/ui/FollowButton';
import PremiumScreen from '../../components/ui/PremiumScreen';
import CloudGlassSurface from '../../components/cloud/CloudGlassSurface';
import PremiumIconButton from '../../components/ui/PremiumIconButton';
import PremiumSegmentedTabs from '../../components/ui/PremiumSegmentedTabs';
import GradientText from '../../components/ui/GradientText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { LocationDisclosureModal } from '../../components/ui/LocationDisclosureModal';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';

const getFontFamily = (weight: '400' | '500' | '600' | '700' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

type TabType = 'community' | 'event' | 'find';
type CommunitySubTab = 'pages' | 'communities';

function formatFeedEventCountdown(startsAt: string | Date): string | null {
  const start = new Date(startsAt).getTime();
  if (!Number.isFinite(start)) return null;
  const diff = start - Date.now();
  if (diff <= 0) return 'Started';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Starts in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `Starts in ${hours}h`;
  const days = Math.round(hours / 24);
  return `Starts in ${days}d`;
}

function formatFeedEventWhen(startsAt: string | Date): string {
  try {
    return new Date(startsAt).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

interface FoundUser {
  _id: string;
  username: string;
  fullName: string;
  profilePic: string;
  bio: string;
  language: string;
  travelStyle?: string;
  isFollowing: boolean;
  followRequestSent?: boolean;
  profileVisibility?: 'public' | 'followers' | 'private';
}

const followStateFor = (user: FoundUser): FollowState => {
  if (user.isFollowing) return 'FOLLOWING';
  if (user.followRequestSent) return 'REQUESTED';
  return 'NOT_FOLLOWING';
};

const isRestrictedProfile = (user: FoundUser) =>
  user.profileVisibility === 'private' || user.profileVisibility === 'followers';

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
    <Modal
      animationType="fade"
      transparent={true}
      visible={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.pickerModal, { backgroundColor: theme.colors.surface, width: '100%' }]}>
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ConnectHubScreen() {
  const { theme, isDark } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topBarHeight = isWeb ? 56 : (56 + (insets.top || 0));
  const [activeTab, setActiveTab] = useState<TabType>('community');
  const [communitySubTab, setCommunitySubTab] = useState<CommunitySubTab>('communities');

  // Event tab list state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedEvents, setFeedEvents] = useState<CommunityEvent[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Community → Pages: user-created (non-admin) pages. Backend ranks followed first.
  const [myPages, setMyPages] = useState<ConnectPageType[]>([]);
  const [myPagesLoading, setMyPagesLoading] = useState(false);
  const [ownedPageIds, setOwnedPageIds] = useState<Set<string>>(new Set());
  const [connectPageNum, setConnectPageNum] = useState(1);
  const [connectHasMore, setConnectHasMore] = useState(true);
  const [connectLoadingMore, setConnectLoadingMore] = useState(false);
  const [connectRefreshing, setConnectRefreshing] = useState(false);

  // Community → Communities: admin-created community pages (former Community tab).
  const [adminCommunities, setAdminCommunities] = useState<ConnectPageType[]>([]);
  const [adminCommunityPageNum, setAdminCommunityPageNum] = useState(1);
  const [adminCommunityHasMore, setAdminCommunityHasMore] = useState(true);
  const [adminCommunityLoading, setAdminCommunityLoading] = useState(false);
  const [adminCommunityLoadingMore, setAdminCommunityLoadingMore] = useState(false);
  const [adminCommunityRefreshing, setAdminCommunityRefreshing] = useState(false);

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
  
  const [selectedState, setSelectedState] = useState<string>('');
  const [stateInput, setStateInput] = useState<string>('');
  const [stateSuggestions, setStateSuggestions] = useState<string[]>([]);
  const [loadingStateSuggestions, setLoadingStateSuggestions] = useState<boolean>(false);
  const stateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedCity, setSelectedCity] = useState<string>('');
  const [cityInput, setCityInput] = useState<string>('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [loadingCitySuggestions, setLoadingCitySuggestions] = useState<boolean>(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear state and city when selectedCurrentCountry changes
  useEffect(() => {
    setSelectedState('');
    setStateInput('');
    setStateSuggestions([]);
    setSelectedCity('');
    setCityInput('');
    setCitySuggestions([]);
  }, [selectedCurrentCountry]);

  // Clear city when selectedState changes
  useEffect(() => {
    setSelectedCity('');
    setCityInput('');
    setCitySuggestions([]);
  }, [selectedState]);

  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedTravelStyle, setSelectedTravelStyle] = useState<string>('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCurrentCountryPicker, setShowCurrentCountryPicker] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [showTravelStylePicker, setShowTravelStylePicker] = useState(false);
  const [foundUsers, setFoundUsers] = useState<FoundUser[]>([]);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [disclosureResolveRef, setDisclosureResolveRef] = useState<{ resolve: (val: boolean) => void } | null>(null);
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
  const userLocationOverriddenRef = useRef(false);

  const formatDetectedLocation = useCallback((address: Location.LocationGeocodedAddress) => {
    return [
      address.city || address.subregion || address.district,
      address.region,
      address.country,
    ].filter(Boolean).join(', ');
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateCurrentLocation = async () => {
      if (activeTab !== 'find' || userLocationOverriddenRef.current || userLocationInput.trim()) return;
      if (Platform.OS === 'web') return;
      try {
        setLoadingUserLocation(true);
        const existingPermission = await Location.getForegroundPermissionsAsync();
        if (existingPermission.status !== 'granted') return;
        const permission = existingPermission;

        if (cancelled || permission.status !== 'granted') return;

        const lastKnown = await Location.getLastKnownPositionAsync();
        const position = lastKnown || await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled || userLocationOverriddenRef.current) return;

        const [address] = await Location.reverseGeocodeAsync(position.coords);
        if (cancelled || userLocationOverriddenRef.current || !address) return;

        const label = formatDetectedLocation(address);
        if (!label) return;
        setUserLocation(label);
        setUserLocationInput(label);
        setUserLocationSuggestions([]);
      } catch (error) {
        logger.debug('Unable to hydrate current location for traveler search:', error);
      } finally {
        if (!cancelled) setLoadingUserLocation(false);
      }
    };

    hydrateCurrentLocation();
    return () => {
      cancelled = true;
    };
  }, [activeTab, formatDetectedLocation, userLocationInput]);

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
        else if (myPages.length === 0) setMyPagesLoading(true);
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
  }, [myPages]);

  const handleLoadMoreConnect = useCallback(() => {
    if (!connectLoadingMore && connectHasMore && !myPagesLoading) {
      fetchMyPages(connectPageNum + 1);
    }
  }, [connectLoadingMore, connectHasMore, myPagesLoading, connectPageNum, fetchMyPages]);

  // Admin community pages (former Community tab features)
  const fetchAdminCommunities = useCallback(async (pNum = 1, isRefresh = false) => {
    try {
      if (pNum === 1) {
        if (isRefresh) setAdminCommunityRefreshing(true);
        else if (adminCommunities.length === 0) setAdminCommunityLoading(true);
      } else {
        setAdminCommunityLoadingMore(true);
      }
      const response = await getCommunities(pNum, 20);
      if (response) {
        if (pNum === 1) setAdminCommunities(response.pages || []);
        else setAdminCommunities((prev) => [...prev, ...(response.pages || [])]);
        setAdminCommunityHasMore(response.pagination.page < response.pagination.totalPages);
        setAdminCommunityPageNum(pNum);
      }
    } catch (error) {
      logger.error('Error fetching communities:', error);
    } finally {
      setAdminCommunityLoading(false);
      setAdminCommunityRefreshing(false);
      setAdminCommunityLoadingMore(false);
    }
  }, [adminCommunities.length]);

  // Fetch public + joined events for Event tab
  const fetchFeedEvents = useCallback(async (pNum = 1, isRefresh = false) => {
    if (activeTab !== 'event') return;
    try {
      if (pNum === 1) {
        if (isRefresh) setRefreshing(true);
        else if (feedEvents.length === 0) setLoading(true);
      }
      const response = await listEventsFeed(pNum, 20);
      if (response) {
        if (pNum === 1) setFeedEvents(response.events || []);
        else setFeedEvents((prev) => [...prev, ...(response.events || [])]);
        setHasMore(response.pagination.page < response.pagination.totalPages);
        setPageNum(pNum);
      }
    } catch (error) {
      logger.error('Error fetching events feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, feedEvents.length]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab === 'community') {
        if (communitySubTab === 'pages') fetchMyPages();
        else fetchAdminCommunities(1);
      } else if (activeTab === 'event') fetchFeedEvents(1);
    }, [fetchMyPages, fetchAdminCommunities, fetchFeedEvents, activeTab, communitySubTab])
  );

  const handleTabChange = (tab: TabType) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === 'event' && feedEvents.length === 0) {
      setFeedEvents([]);
      setPageNum(1);
      setHasMore(true);
      setLoading(true);
    }
    if (tab === 'community') {
      if (communitySubTab === 'pages' && myPages.length === 0) {
        setMyPagesLoading(true);
      }
      if (communitySubTab === 'communities' && adminCommunities.length === 0) {
        setAdminCommunityLoading(true);
      }
    }
  };

  const handleCommunitySubTabChange = (sub: CommunitySubTab) => {
    if (sub === communitySubTab) return;
    setCommunitySubTab(sub);
    if (sub === 'pages' && myPages.length === 0) setMyPagesLoading(true);
    if (sub === 'communities' && adminCommunities.length === 0) {
      setAdminCommunityLoading(true);
    }
  };

  const handleDisclosureContinue = async () => {
    setShowLocationDisclosure(false);
    const resolve = disclosureResolveRef?.resolve;
    setDisclosureResolveRef(null);
    try {
      const fgResult = await Location.requestForegroundPermissionsAsync();
      resolve?.(fgResult.status === 'granted');
    } catch (err) {
      logger.error('Error requesting location permission in connect find:', err);
      resolve?.(false);
    }
  };

  const handleDisclosureCancel = () => {
    setShowLocationDisclosure(false);
    const resolve = disclosureResolveRef?.resolve;
    setDisclosureResolveRef(null);
    resolve?.(false);
  };

  const handleFindUsers = async () => {
    if (!selectedLanguage) return;

    let targetLocationInput = userLocationInput.trim();

    // If no location inputted and permission not granted, ask for it!
    if (!targetLocationInput) {
      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        if (existingPermission.status === 'undetermined') {
          const granted = await new Promise<boolean>((resolve) => {
            setDisclosureResolveRef({ resolve });
            setShowLocationDisclosure(true);
          });
          if (granted) {
            setLoadingUserLocation(true);
            const lastKnown = await Location.getLastKnownPositionAsync();
            const position = lastKnown || await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const [address] = await Location.reverseGeocodeAsync(position.coords);
            if (address) {
              const label = formatDetectedLocation(address);
              if (label) {
                targetLocationInput = label;
                setUserLocation(label);
                setUserLocationInput(label);
              }
            }
            setLoadingUserLocation(false);
          }
        }
      } catch (err) {
        logger.debug('Skipping location prompt / fetch in find users:', err);
        setLoadingUserLocation(false);
      }
    }

    try {
      setFindLoading(true);
      const response = await findUsers({
        target_country: selectedCountry || undefined,
        current_country: selectedCurrentCountry || undefined,
        travel_style: selectedTravelStyle || undefined,
        lang: selectedLanguage,
        user_location: targetLocationInput || undefined,
        state: selectedState || undefined,
        city: selectedCity || undefined,
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
    userLocationOverriddenRef.current = true;
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
    userLocationOverriddenRef.current = true;
    setUserLocation(place);
    setUserLocationInput(place);
    setUserLocationSuggestions([]);
    if (userLocationDebounceRef.current) {
      clearTimeout(userLocationDebounceRef.current);
      userLocationDebounceRef.current = null;
    }
  };

  const handleStateChange = (text: string) => {
    setStateInput(text);
    if (selectedState) setSelectedState('');
    if (stateDebounceRef.current) clearTimeout(stateDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setStateSuggestions([]);
      setLoadingStateSuggestions(false);
      return;
    }
    setLoadingStateSuggestions(true);
    stateDebounceRef.current = setTimeout(async () => {
      try {
        const suggestions = await getStateSuggestions(trimmed, selectedCurrentCountry);
        setStateSuggestions(suggestions);
      } catch (e) {
        setStateSuggestions([]);
      } finally {
        setLoadingStateSuggestions(false);
      }
    }, 350);
  };

  const handleStateSelect = (place: string) => {
    setSelectedState(place);
    setStateInput(place);
    setStateSuggestions([]);
    if (stateDebounceRef.current) {
      clearTimeout(stateDebounceRef.current);
      stateDebounceRef.current = null;
    }
  };

  const handleCityChange = (text: string) => {
    setCityInput(text);
    if (selectedCity) setSelectedCity('');
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setCitySuggestions([]);
      setLoadingCitySuggestions(false);
      return;
    }
    setLoadingCitySuggestions(true);
    cityDebounceRef.current = setTimeout(async () => {
      try {
        // Concat the selected state to ensure Google Autocomplete limits suggestions to this state
        const queryText = selectedState ? `${trimmed}, ${selectedState}` : trimmed;
        const suggestions = await getPlaceSuggestions(queryText, selectedCurrentCountry);
        setCitySuggestions(suggestions);
      } catch (e) {
        setCitySuggestions([]);
      } finally {
        setLoadingCitySuggestions(false);
      }
    }, 350);
  };

  const handleCitySelect = (place: string) => {
    const firstPart = place.split(',')[0].trim();
    setSelectedCity(firstPart);
    setCityInput(firstPart);
    setCitySuggestions([]);
    if (cityDebounceRef.current) {
      clearTimeout(cityDebounceRef.current);
      cityDebounceRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (userLocationDebounceRef.current) clearTimeout(userLocationDebounceRef.current);
      if (stateDebounceRef.current) clearTimeout(stateDebounceRef.current);
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    };
  }, []);

  // Keep Find-tab cards + the bottom sheet in sync with FollowButton / profile privacy.
  const applyFoundUserFollowState = useCallback((userId: string, state: FollowState) => {
    const patch = {
      isFollowing: state === 'FOLLOWING',
      followRequestSent: state === 'REQUESTED',
    };
    setFoundUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, ...patch } : u)));
    setSelectedUser((prev) => (prev && prev._id === userId ? { ...prev, ...patch } : prev));
  }, []);

  // Page follow toggle (Community → Pages & Communities cards)
  const handlePageFollowToggle = async (pageItem: ConnectPageType) => {
    // Defensive: never POST follow/unfollow against the user's own page.
    // Backend rejects it with "Cannot follow your own page", which surfaced
    // as a confusing toggle error when isOwn / ownedPageIds momentarily
    // weren't in sync with the rendered card.
    if (pageItem.isOwn || ownedPageIds.has(pageItem._id)) return;
    const wasFollowing = pageItem.isFollowing;
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
    setMyPages(applyOptimistic);
    setAdminCommunities(applyOptimistic);
    try {
      if (wasFollowing) await unfollowConnectPage(pageItem._id);
      else await followConnectPage(pageItem._id);
    } catch (error) {
      setMyPages(rollback);
      setAdminCommunities(rollback);
      logger.error('Error toggling follow:', error);
    }
  };

  const handleLoadMoreAdminCommunities = () => {
    if (
      !adminCommunityLoadingMore &&
      adminCommunityHasMore &&
      !adminCommunityLoading &&
      activeTab === 'community' &&
      communitySubTab === 'communities'
    ) {
      void fetchAdminCommunities(adminCommunityPageNum + 1);
    }
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading && activeTab === 'event') {
      setLoadingMore(true);
      fetchFeedEvents(pageNum + 1);
    }
  };

  const renderFeedEventItem = ({ item }: { item: CommunityEvent }) => {
    const pageId = String(item.connectPageId || item.page?._id || '');
    const starts = new Date(item.startsAt);
    const day = Number.isFinite(starts.getTime()) ? String(starts.getDate()) : '—';
    const mon = Number.isFinite(starts.getTime())
      ? starts.toLocaleString(undefined, { month: 'short' }).toUpperCase()
      : '';
    const countdown = formatFeedEventCountdown(item.startsAt);
    const ink = theme.colors.text;
    const muted = theme.colors.textSecondary;
    const accent = isDark ? '#38BDF8' : '#1C73B4';
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          if (!pageId) return;
          router.push(`/connect/page/${pageId}`);
        }}
        style={{
          marginBottom: 12,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
          overflow: 'hidden',
          shadowColor: '#0F172A',
          shadowOpacity: isDark ? 0 : 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: isDark ? 0 : 2,
        }}
      >
        <View style={{ flexDirection: 'row', padding: 14, gap: 12 }}>
          <View
            style={{
              width: 56,
              borderRadius: 14,
              backgroundColor: isDark ? 'rgba(251,191,36,0.16)' : '#FEF3C7',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
            }}
          >
            <Text style={{ color: isDark ? '#FBBF24' : '#B45309', fontWeight: '800', fontSize: 18, lineHeight: 22 }}>
              {day}
            </Text>
            <Text style={{ color: isDark ? '#FCD34D' : '#D97706', fontWeight: '700', fontSize: 10, letterSpacing: 0.4 }}>
              {mon}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={{ color: ink, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={{ color: muted, fontSize: 12 }} numberOfLines={1}>
              {formatFeedEventWhen(item.startsAt)}
              {item.location?.address ? ` · ${item.location.address}` : ''}
            </Text>
            {item.page?.name ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {item.page.profileImage ? (
                  <Image
                    source={{ uri: item.page.profileImage }}
                    style={{ width: 18, height: 18, borderRadius: 6 }}
                  />
                ) : (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 6,
                      backgroundColor: isDark ? 'rgba(56,189,248,0.2)' : 'rgba(28,115,180,0.12)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="people" size={10} color={accent} />
                  </View>
                )}
                <Text style={{ color: accent, fontSize: 12, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {item.page.name}
                </Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {item.isRegistered ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(80,200,120,0.18)' : 'rgba(16,124,65,0.1)',
                  }}
                >
                  <Text style={{ color: isDark ? '#7DDEA3' : '#107C41', fontSize: 11, fontWeight: '700' }}>
                    You're in
                  </Text>
                </View>
              ) : null}
              {item.isWaitlisted ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.12)',
                  }}
                >
                  <Text style={{ color: isDark ? '#FBBF24' : '#B45309', fontSize: 11, fontWeight: '700' }}>
                    Waitlist
                  </Text>
                </View>
              ) : null}
              {item.competition?.enabled ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(251,191,36,0.16)' : 'rgba(234,88,12,0.1)',
                  }}
                >
                  <Ionicons name="trophy" size={11} color={isDark ? '#FBBF24' : '#C2410C'} />
                  <Text style={{ color: isDark ? '#FBBF24' : '#C2410C', fontSize: 11, fontWeight: '700' }}>
                    Competition
                  </Text>
                </View>
              ) : null}
              {countdown ? (
                <View
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(56,189,248,0.14)' : 'rgba(28,115,180,0.08)',
                  }}
                >
                  <Text style={{ color: accent, fontSize: 11, fontWeight: '700' }}>{countdown}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={muted} style={{ alignSelf: 'center' }} />
        </View>
      </TouchableOpacity>
    );
  };

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
        <FollowButton
          userId={user._id}
          initialState={followStateFor(user)}
          isPrivate={isRestrictedProfile(user)}
          size="small"
          onToggle={(state) => applyFoundUserFollowState(user._id, state)}
        />
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

  const renderCommunitySubTabs = () => {
    const accent = isDark ? '#38BDF8' : '#1C73B4';
    const muted = theme.colors.textSecondary;
    const chips: { key: CommunitySubTab; label: string }[] = [
      { key: 'communities', label: 'Communities' },
      { key: 'pages', label: 'Pages' },
    ];
    return (
      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          paddingHorizontal: isTablet ? themeConstants.spacing.md : 12,
          paddingTop: 4,
          paddingBottom: 8,
        }}
      >
        {chips.map((chip) => {
          const active = communitySubTab === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              onPress={() => handleCommunitySubTabChange(chip.key)}
              activeOpacity={0.85}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: active
                  ? isDark
                    ? 'rgba(56,189,248,0.18)'
                    : 'rgba(28,115,180,0.12)'
                  : isDark
                    ? 'rgba(255,255,255,0.06)'
                    : 'rgba(15,23,42,0.05)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: active
                  ? accent
                  : isDark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(15,23,42,0.08)',
              }}
            >
              <Text
                style={{
                  color: active ? accent : muted,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Community → Pages (former Connect tab) — user-created pages + follow + create FAB
  const renderCommunityPagesList = () => {
    if (myPagesLoading && myPages.length === 0) {
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
          description="Create your first page to share with the community."
        />
      );
    }

    return (
      <FlashList
        data={myPages}
        renderItem={({ item }: { item: ConnectPageType }) => {
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

  // Community → Communities (former Community tab) — admin communities + follow
  const renderAdminCommunitiesList = () => {
    if (adminCommunityLoading && adminCommunities.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (adminCommunities.length === 0) {
      return (
        <EmptyState
          icon="globe-outline"
          title="No communities yet"
          description="Community pages created by admins will appear here."
        />
      );
    }

    return (
      <FlashList
        data={adminCommunities}
        renderItem={({ item }: { item: ConnectPageType }) => (
          <ConnectCard
            page={item}
            onPress={() => router.push(`/connect/page/${item._id}`)}
            onFollowPress={() => handlePageFollowToggle(item)}
            isFollowing={!!item.isFollowing}
            showFollowButton
          />
        )}
        keyExtractor={(item: ConnectPageType) => item._id}
        contentContainerStyle={{ padding: isTablet ? themeConstants.spacing.md : 8 } as any}
        onEndReached={handleLoadMoreAdminCommunities}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          adminCommunityLoadingMore ? (
            <View style={styles.footerLoader}>
              <LoadingGlobe size="small" color={theme.colors.primary} />
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={adminCommunityRefreshing}
            onRefresh={() => fetchAdminCommunities(1, true)}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    );
  };

  const renderCommunityTab = () => (
    <View style={{ flex: 1 }}>
      {renderCommunitySubTabs()}
      <View style={{ flex: 1 }}>
        {communitySubTab === 'pages' ? renderCommunityPagesList() : renderAdminCommunitiesList()}
      </View>
    </View>
  );

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

          <View style={[styles.sheetAction, { borderBottomColor: theme.colors.border, justifyContent: 'center' }]}>
            <FollowButton
              userId={selectedUser._id}
              initialState={followStateFor(selectedUser)}
              isPrivate={isRestrictedProfile(selectedUser)}
              size="medium"
              onToggle={(state) => applyFoundUserFollowState(selectedUser._id, state)}
            />
          </View>

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
    <KeyboardAvoidingView
      style={styles.findKeyboardWrapper}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={topBarHeight}
    >
    <ScrollView
      style={styles.findContainer}
      contentContainerStyle={styles.findContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
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
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          Your current location
        </Text>
        <View style={[styles.filterSelect, {
          backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
          borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
        }]}>
          <Ionicons name="navigate-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
          <TextInput
            style={[styles.filterTextInput, { color: isDark ? '#38BDF8' : '#1C73B4' }]}
            value={userLocationInput}
            onChangeText={handleUserLocationChange}
            placeholder="Type a city…"
            placeholderTextColor={isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'}
            autoCorrect={false}
            autoCapitalize="words"
            returnKeyType="search"
            underlineColorAndroid="transparent"
          />
          {loadingUserLocation ? (
            <LoadingGlobe size="small" color={isDark ? '#38BDF8' : '#1C73B4'} />
          ) : userLocationInput.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                userLocationOverriddenRef.current = true;
                setUserLocation('');
                setUserLocationInput('');
                setUserLocationSuggestions([]);
              }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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

        <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          Nationality
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, {
            backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
            borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
          }]}
          onPress={() => setShowCountryPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="flag-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
          <Text style={[styles.filterSelectText, { color: selectedCountry ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)') }]}>
            {getSelectedLabel(countries, selectedCountry, 'Select country (optional)')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
        </TouchableOpacity>

        <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          Current Location / Residence
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, {
            backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
            borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
          }]}
          onPress={() => setShowCurrentCountryPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="location-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
          <Text style={[styles.filterSelectText, { color: selectedCurrentCountry ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)') }]}>
            {getSelectedLabel(countries, selectedCurrentCountry, 'Select country (optional)')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
        </TouchableOpacity>

        {selectedCurrentCountry ? (
          <>
            <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              State
            </Text>
            <View style={[styles.filterSelect, {
              backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
            }]}>
              <Ionicons name="map-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
              <TextInput
                style={[styles.filterTextInput, { color: isDark ? '#38BDF8' : '#1C73B4' }]}
                value={stateInput}
                onChangeText={handleStateChange}
                placeholder="Type a state…"
                placeholderTextColor={isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'}
                autoCorrect={false}
                autoCapitalize="words"
                underlineColorAndroid="transparent"
              />
              {loadingStateSuggestions ? (
                <LoadingGlobe size="small" color={isDark ? '#38BDF8' : '#1C73B4'} />
              ) : stateInput.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedState('');
                    setStateInput('');
                    setStateSuggestions([]);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
                </TouchableOpacity>
              ) : null}
            </View>
            {stateSuggestions.length > 0 && !selectedState && (
              <View style={[styles.suggestionsList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {stateSuggestions.slice(0, 5).map((s, idx) => (
                  <TouchableOpacity
                    key={`state-${s}-${idx}`}
                    style={[styles.suggestionItem, idx < stateSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}
                    onPress={() => handleStateSelect(s)}
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
          </>
        ) : null}

        {selectedState ? (
          <>
            <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
              City
            </Text>
            <View style={[styles.filterSelect, {
              backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
            }]}>
              <Ionicons name="business-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
              <TextInput
                style={[styles.filterTextInput, { color: isDark ? '#38BDF8' : '#1C73B4' }]}
                value={cityInput}
                onChangeText={handleCityChange}
                placeholder="Type a city…"
                placeholderTextColor={isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)'}
                autoCorrect={false}
                autoCapitalize="words"
                underlineColorAndroid="transparent"
              />
              {loadingCitySuggestions ? (
                <LoadingGlobe size="small" color={isDark ? '#38BDF8' : '#1C73B4'} />
              ) : cityInput.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedCity('');
                    setCityInput('');
                    setCitySuggestions([]);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="close-circle" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
                </TouchableOpacity>
              ) : null}
            </View>
            {citySuggestions.length > 0 && !selectedCity && (
              <View style={[styles.suggestionsList, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                {citySuggestions.slice(0, 5).map((s, idx) => (
                  <TouchableOpacity
                    key={`city-${s}-${idx}`}
                    style={[styles.suggestionItem, idx < citySuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}
                    onPress={() => handleCitySelect(s)}
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
          </>
        ) : null}

        {/* Language Picker */}
        <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          Language (required)
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, {
            backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
            borderColor: !selectedLanguage ? (isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(28, 115, 180, 0.4)') : (isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)')
          }]}
          onPress={() => setShowLanguagePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="language-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
          <Text style={[styles.filterSelectText, { color: selectedLanguage ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)') }]}>
            {getSelectedLabel(languages, selectedLanguage, 'Select Language *')}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
        </TouchableOpacity>

        <Text style={[styles.filterFieldLabel, { color: isDark ? '#FFFFFF' : theme.colors.text }]}>
          Travel Style
        </Text>
        <TouchableOpacity
          style={[styles.filterSelect, {
            backgroundColor: isDark ? '#0A1E35' : '#E6F0FA',
            borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(28, 115, 180, 0.2)'
          }]}
          onPress={() => setShowTravelStylePicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="compass-outline" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
          <Text style={[styles.filterSelectText, { color: selectedTravelStyle ? (isDark ? '#38BDF8' : '#1C73B4') : (isDark ? 'rgba(56, 189, 248, 0.6)' : 'rgba(28, 115, 180, 0.6)') }]}>
            {selectedTravelStyle ? TRAVEL_STYLES.find(s => s.code === selectedTravelStyle)?.name || 'Travel Style' : 'Select Travel Style (optional)'}
          </Text>
          <Ionicons name="chevron-down" size={18} color={isDark ? '#38BDF8' : '#1C73B4'} />
        </TouchableOpacity>

        {/* Search Button */}
        <TouchableOpacity
          style={{ marginTop: 4, opacity: !selectedLanguage || findLoading ? 0.5 : 1 }}
          onPress={handleFindUsers}
          disabled={!selectedLanguage || findLoading}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
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
    </KeyboardAvoidingView>
  );

  const renderEventFeedTab = () => {
    if (loading && feedEvents.length === 0) {
      return (
        <View style={styles.loadingContainer}>
          <LoadingGlobe size="large" color={theme.colors.primary} />
        </View>
      );
    }

    if (feedEvents.length === 0) {
      return (
        <EmptyState
          icon="calendar-outline"
          title="No events yet"
          description="Public events and anything you’ve joined will show up here."
        />
      );
    }

    return (
      <FlashList
        data={feedEvents}
        renderItem={renderFeedEventItem}
        keyExtractor={(item: CommunityEvent) => item._id}
        contentContainerStyle={{ padding: isTablet ? themeConstants.spacing.md : 12 } as any}
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
            onRefresh={() => fetchFeedEvents(1, true)}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      />
    );
  };

  const tabs: { key: TabType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'community', label: 'Community', icon: 'people-outline' },
    { key: 'event', label: 'Event', icon: 'calendar-outline' },
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
            backgroundColor: isDark ? 'rgba(13, 27, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)',
          }
        ]}
      >
        <BlurView
          intensity={80}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
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
        <View style={[styles.listSlot, activeTab === 'community' ? null : styles.hidden]} pointerEvents={activeTab === 'community' ? 'auto' : 'none'}>
          {renderCommunityTab()}
        </View>
        <View style={[styles.listSlot, activeTab === 'find' ? null : styles.hidden]} pointerEvents={activeTab === 'find' ? 'auto' : 'none'}>
          {renderFindTab()}
        </View>
        <View style={[styles.listSlot, activeTab === 'event' ? null : styles.hidden]} pointerEvents={activeTab === 'event' ? 'auto' : 'none'}>
          {renderEventFeedTab()}
        </View>
      </View>

      {/* FAB — Create page (Community → Pages only) */}
      {activeTab === 'community' && communitySubTab === 'pages' && (
        <TouchableOpacity
          style={{
            position: 'absolute',
            right: isTablet ? 32 : 20,
            bottom: isTablet ? 32 : 20,
            width: isTablet ? 60 : 56,
            height: isTablet ? 60 : 56,
            shadowColor: theme.colors.glowBlue || '#32A8FF',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.35,
            shadowRadius: 18,
            elevation: 8,
          }}
          onPress={() => router.push('/connect/create')}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#50C878', '#1C73B4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: isTablet ? 30 : 28,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* User Bottom Sheet (Find tab) */}
      {renderUserBottomSheet()}

      {/* Picker Modals */}
      {renderPickerModal(showCountryPicker, countries, selectedCountry, setSelectedCountry, () => setShowCountryPicker(false), 'People from')}
      {renderPickerModal(showCurrentCountryPicker, countries, selectedCurrentCountry, setSelectedCurrentCountry, () => setShowCurrentCountryPicker(false), 'Currently in')}
      {renderPickerModal(showLanguagePicker, languages, selectedLanguage, setSelectedLanguage, () => setShowLanguagePicker(false), 'Select Language')}
      {renderPickerModal(showTravelStylePicker, TRAVEL_STYLES, selectedTravelStyle, setSelectedTravelStyle, () => setShowTravelStylePicker(false), 'Select Travel Style')}

      {/* Location Disclosure Modal */}
      <LocationDisclosureModal
        visible={showLocationDisclosure}
        variant="foreground"
        onContinue={handleDisclosureContinue}
        onCancel={handleDisclosureCancel}
      />
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
  listSlot: {
    flex: 1,
  },
  hidden: {
    display: 'none',
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
  findKeyboardWrapper: {
    flex: 1,
  },
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
