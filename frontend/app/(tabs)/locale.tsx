import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getProfile } from '../../services/profile';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';
import { geocodeAddress } from '../../utils/locationUtils';
import { LinearGradient } from 'expo-linear-gradient';
import { getCountries, getStatesByCountry, Country, State } from '../../services/location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { useReducer, useMemo, useCallback, useRef } from 'react';
import api from '../../services/api';

const logger = createLogger('LocaleScreen');

const { width } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  postId?: string;
  imageUrl?: string;
}

interface FilterState {
  country: string;
  countryCode: string;
  stateProvince: string;
  stateCode: string;
  spotTypes: string[];
  searchRadius: string;
}

type FilterAction =
  | { type: 'SET_COUNTRY'; payload: { country: string; countryCode: string } }
  | { type: 'SET_STATE'; payload: { stateProvince: string; stateCode: string } }
  | { type: 'TOGGLE_SPOT_TYPE'; payload: string }
  | { type: 'SET_SEARCH_RADIUS'; payload: string }
  | { type: 'RESET' };

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
  switch (action.type) {
    case 'SET_COUNTRY':
      return { ...state, country: action.payload.country, countryCode: action.payload.countryCode, stateProvince: '', stateCode: '' };
    case 'SET_STATE':
      return { ...state, stateProvince: action.payload.stateProvince, stateCode: action.payload.stateCode };
    case 'TOGGLE_SPOT_TYPE':
      const spotTypes = state.spotTypes.includes(action.payload)
        ? state.spotTypes.filter(t => t !== action.payload)
        : [...state.spotTypes, action.payload];
      return { ...state, spotTypes };
    case 'SET_SEARCH_RADIUS':
      return { ...state, searchRadius: action.payload };
    case 'RESET':
      return {
        country: 'United Kingdom',
        countryCode: 'GB',
        stateProvince: '',
        stateCode: '',
        spotTypes: [],
        searchRadius: '',
      };
    default:
      return state;
  }
};

export default function LocaleScreen() {
  const { handleScroll } = useScrollToHideNav();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'locale' | 'saved'>('locale');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingStates, setLoadingStates] = useState(false);
  const [filters, dispatchFilter] = useReducer(filterReducer, {
    country: 'United Kingdom',
    countryCode: 'GB',
    stateProvince: '',
    stateCode: '',
    spotTypes: [],
    searchRadius: '',
  });
  
  // Location caching
  const CACHE_KEY = 'locations_cache';
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  const { theme, mode } = useTheme();
  const router = useRouter();

  const spotTypeOptions = [
    'Historical spots',
    'Cultural spots',
    'Natural spots',
    'Adventure spots',
    'Religious/spiritual spots',
    'Wildlife spots',
    'Beach spots',
  ];

  useEffect(() => {
    loadUserLocations();
    loadCountries();
    loadSavedLocations();
  }, []);

  useEffect(() => {
    // Reload saved locations when tab changes
    if (activeTab === 'saved') {
      loadSavedLocations();
    }
  }, [activeTab]);

  const loadSavedLocations = async () => {
    try {
      const saved = await AsyncStorage.getItem('savedLocations');
      const locations = saved ? JSON.parse(saved) : [];
      setSavedLocations(locations);
    } catch (error) {
      logger.error('Error loading saved locations', error);
      setSavedLocations([]);
    }
  };

  const loadCountries = async () => {
    try {
      setLoadingCountries(true);
      const countriesData = await getCountries();
      setCountries(countriesData);
      
      // Load states for the default country
      if (countriesData.length > 0) {
        await loadStatesForCountry(filters.countryCode);
      }
    } catch (error) {
      logger.debug('Countries loaded from static data');
      // Countries will be loaded from static data automatically
    } finally {
      setLoadingCountries(false);
    }
  };

  const loadStatesForCountry = async (countryCode: string) => {
    try {
      setLoadingStates(true);
      const statesData = await getStatesByCountry(countryCode);
      setStates(statesData);
      
      // If no states found, show a message
      if (statesData.length === 0) {
        logger.debug(`No states/provinces available for country code: ${countryCode}`);
      }
    } catch (error) {
      logger.debug(`States loaded from static data for ${countryCode}`);
      setStates([]); // Ensure states array is empty on error
    } finally {
      setLoadingStates(false);
    }
  };

  const handleCountrySelect = async (country: Country) => {
    dispatchFilter({ type: 'SET_COUNTRY', payload: { country: country.name, countryCode: country.code } });
    setShowCountryDropdown(false);
    
    // Load states for the selected country
    await loadStatesForCountry(country.code);
  };

  const handleStateSelect = (state: State) => {
    dispatchFilter({ type: 'SET_STATE', payload: { stateProvince: state.name, stateCode: state.code } });
    setShowStateDropdown(false);
  };

  const loadUserLocations = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const user = await getUserFromStorage();
      if (!user) {
        Alert.alert('Error', 'Please sign in to view your locations');
        router.push('/(auth)/signin');
        return;
      }

      // Check cache first
      if (!forceRefresh) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setLocations(data);
            setLoading(false);
            return;
          }
        }
      }

      // Fetch from API - get posts with locations
      const response = await api.get(`/api/v1/posts?user=${user._id}&hasLocation=true`);
      const postsWithLocations = response.data.posts || [];
      
      // Transform posts to location data format
      const locationData: LocationData[] = postsWithLocations
        .filter((post: any) => post.location && post.location.coordinates)
        .map((post: any) => ({
          latitude: post.location.coordinates.latitude,
          longitude: post.location.coordinates.longitude,
          address: post.location.address || 'Unknown Location',
          date: post.createdAt,
          postId: post._id,
          imageUrl: post.imageUrl || post.images?.[0],
        }));

      setLocations(locationData);
      
      // Update cache
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data: locationData,
        timestamp: Date.now()
      }));
    } catch (error: any) {
      logger.error('Failed to fetch locations', error);
      Alert.alert('Error', 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadUserLocations();
    setRefreshing(false);
  };

  const toggleSpotType = (spotType: string) => {
    dispatchFilter({ type: 'TOGGLE_SPOT_TYPE', payload: spotType });
  };

  const handleSearch = () => {
    setShowFilterModal(false);
    // Reload locations with filters applied
    loadUserLocations(true);
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={[styles.filterModalContainer, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
        
        {/* Header */}
        <View style={[styles.filterHeader, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.filterTitle, { color: theme.colors.text }]}>FILTER</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.filterContent} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {/* Country */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>COUNTRY</Text>
            <TouchableOpacity 
              style={[styles.dropdownField, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              }]}
              onPress={() => setShowCountryDropdown(!showCountryDropdown)}
            >
              <Text style={[styles.dropdownText, { color: theme.colors.text }]}>
                {filters.country || 'Select Country'}
              </Text>
              <View style={styles.dropdownIconContainer}>
                {loadingCountries ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons 
                    name={showCountryDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                )}
              </View>
            </TouchableOpacity>
            
            {/* Country Dropdown */}
            {showCountryDropdown && (
              <View style={[styles.dropdownList, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.text,
              }]}>
                <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                  {countries.map((country, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.dropdownItem, { 
                        backgroundColor: filters.countryCode === country.code ? theme.colors.primary + '15' : 'transparent',
                        borderBottomColor: theme.colors.border,
                      }]}
                      onPress={() => handleCountrySelect(country)}
                    >
                      <Text style={[styles.dropdownItemText, { 
                        color: filters.countryCode === country.code ? theme.colors.primary : theme.colors.text,
                        fontWeight: filters.countryCode === country.code ? '600' : '400',
                      }]}>
                        {country.name}
                      </Text>
                      {filters.countryCode === country.code && (
                        <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* State/Province */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>STATE/PROVINCE</Text>
            <TouchableOpacity 
              style={[styles.dropdownField, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                opacity: !filters.countryCode ? 0.5 : 1,
              }]}
              onPress={() => filters.countryCode && setShowStateDropdown(!showStateDropdown)}
              disabled={!filters.countryCode}
            >
              <Text style={[styles.dropdownText, { color: theme.colors.text }]}>
                {filters.stateProvince || 'Select State/Province'}
              </Text>
              <View style={styles.dropdownIconContainer}>
                {loadingStates ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons 
                    name={showStateDropdown ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color={theme.colors.textSecondary} 
                  />
                )}
              </View>
            </TouchableOpacity>
            
            {/* State Dropdown */}
            {showStateDropdown && (
              <View style={[styles.dropdownList, { 
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
                shadowColor: theme.colors.text,
              }]}>
                {states.length > 0 ? (
                  <ScrollView style={styles.dropdownScrollView} nestedScrollEnabled>
                    {states.map((state, index) => (
                      <TouchableOpacity
                        key={index}
                        style={[styles.dropdownItem, { 
                          backgroundColor: filters.stateCode === state.code ? theme.colors.primary + '15' : 'transparent',
                          borderBottomColor: theme.colors.border,
                        }]}
                        onPress={() => handleStateSelect(state)}
                      >
                        <Text style={[styles.dropdownItemText, { 
                          color: filters.stateCode === state.code ? theme.colors.primary : theme.colors.text,
                          fontWeight: filters.stateCode === state.code ? '600' : '400',
                        }]}>
                          {state.name}
                        </Text>
                        {filters.stateCode === state.code && (
                          <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={[styles.dropdownItem, { 
                    backgroundColor: 'transparent',
                    borderBottomColor: theme.colors.border,
                  }]}>
                    <Text style={[styles.dropdownItemText, { 
                      color: theme.colors.textSecondary,
                      fontStyle: 'italic',
                    }]}>
                      No states/provinces available
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Type of Spot */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>TYPE OF SPOT</Text>
            {spotTypeOptions.map((spotType, index) => (
              <TouchableOpacity
                key={index}
                style={styles.spotTypeOption}
                onPress={() => toggleSpotType(spotType)}
              >
                <View style={[
                  styles.checkbox,
                  { 
                    borderColor: theme.colors.border,
                    backgroundColor: theme.colors.surface,
                  },
                  filters.spotTypes.includes(spotType) && {
                    backgroundColor: theme.colors.primary,
                    borderColor: theme.colors.primary,
                  }
                ]}>
                  {filters.spotTypes.includes(spotType) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text style={[styles.spotTypeText, { color: theme.colors.text }]}>{spotType}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Radius */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterSectionTitle, { color: theme.colors.text }]}>SEARCH RADIUS</Text>
            <View style={[styles.radiusContainer, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <TextInput
                style={[styles.radiusInput, { color: theme.colors.text }]}
                placeholder="Enter radius in km"
                placeholderTextColor={theme.colors.textSecondary}
                value={filters.searchRadius}
                onChangeText={(text) => dispatchFilter({ type: 'SET_SEARCH_RADIUS', payload: text })}
                keyboardType="numeric"
              />
              <Text style={[styles.radiusUnit, { color: theme.colors.textSecondary }]}>km</Text>
            </View>
          </View>
        </ScrollView>

        {/* Search Button */}
        <View style={[styles.filterFooter, { backgroundColor: theme.colors.background, borderTopColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={[styles.searchButton, { backgroundColor: theme.colors.primary }]} 
            onPress={handleSearch}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderLocationCard = useCallback(({ item, index }: { item: any; index: number }) => {
    // All cards are wide cards now
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.wideCard,
          { marginLeft: 0 }
        ]}
        onPress={async () => {
          if (isGeocoding) return; // Prevent multiple clicks during geocoding
          
          setIsGeocoding(item.name);
          
          try {
            logger.debug('Navigating to location detail:', item.name);
            
            // Get user ID for navigation
            const user = await getUserFromStorage();
            const userId = user?._id || 'current-user';
            
            // Convert location name to slug format
            const locationSlug = item.name.toLowerCase().replace(/\s+/g, '-');
            
            // Navigate to location detail page first
            router.push({
              pathname: '/tripscore/countries/[country]/locations/[location]',
              params: {
                country: 'general',
                location: locationSlug,
                userId: userId,
              }
            });
          } catch (error) {
            logger.error('Error navigating to location', error);
          } finally {
            setIsGeocoding(null);
          }
        }}
      >
        <Image 
          source={{ uri: item.imageUrl || 'https://via.placeholder.com/400x300' }} 
          style={styles.cardImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [isGeocoding, router, theme]);

  const renderCurrentLocationCard = (currentLocation: any) => {
    // Use OpenStreetMap since Google Maps is failing
    const mapUrl = `https://tile.openstreetmap.org/15/${Math.floor((currentLocation.longitude + 180) / 360 * Math.pow(2, 15))}/${Math.floor((1 - Math.log(Math.tan(currentLocation.latitude * Math.PI / 180) + 1 / Math.cos(currentLocation.latitude * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 15))}.png`;
    
    logger.debug('Using OpenStreetMap URL:', mapUrl);
    
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.halfCard,
          { marginLeft: 0 }
        ]}
        onPress={async () => {
          if (isGeocoding) return;
          
          setIsGeocoding('Current Location');
          
          try {
            logger.debug('Navigating to current location detail:', currentLocation.address);
            
            // Get user ID for navigation
            const user = await getUserFromStorage();
            const userId = user?._id || 'current-user';
            
            // Convert location name to slug format
            const locationSlug = currentLocation.address.toLowerCase().replace(/\s+/g, '-');
            
            // Navigate to location detail page first
            router.push({
              pathname: '/tripscore/countries/[country]/locations/[location]',
              params: {
                country: 'general',
                location: locationSlug,
                userId: userId,
              }
            });
          } catch (error) {
            logger.error('Error navigating to current location', error);
          } finally {
            setIsGeocoding(null);
          }
        }}
      >
        <Image
          source={{ uri: mapUrl }}
          style={styles.cardImage}
          resizeMode="cover"
          onError={(error) => {
            logger.error('OpenStreetMap failed', error.nativeEvent.error);
          }}

          onLoad={() => {
            logger.debug('OpenStreetMap loaded successfully');
          }}
        />
        {/* Red marker overlay for location */}
        <View style={styles.markerOverlay}>
          <Ionicons name="location" size={20} color="red" />
        </View>
        {/* Fallback gradient if image fails - positioned behind the image */}
        <LinearGradient
          colors={['#D4EDDA', '#A8DADC']}
          style={[styles.cardImage, { position: 'absolute', top: 0, left: 0, zIndex: -1 }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.mapPlaceholder}>
            <Ionicons name="location" size={40} color="#2C5530" />
            <Text style={styles.mapPlaceholderText}>Current Location</Text>
          </View>
        </LinearGradient>
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{currentLocation.address}</Text>
        </View>
        {isGeocoding === 'Current Location' && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Memoize location cards
  const memoizedLocationCards = useMemo(() => {
    return locations.map((location, index) => ({
      id: location.postId || `loc-${index}`,
      name: location.address,
      imageUrl: location.imageUrl,
      latitude: location.latitude,
      longitude: location.longitude,
      date: location.date,
    }));
  }, [locations]);

  const renderCustomLayout = useCallback(() => {
    if (locations.length === 0) {
      return renderEmptyState();
    }
    
    return (
      <View style={styles.listContainer}>
        {memoizedLocationCards.map((item, index) => (
          <View key={item.id}>
            {renderLocationCard({ item, index })}
          </View>
        ))}
      </View>
    );
  }, [memoizedLocationCards, locations.length]);

  const renderSavedLocationCard = ({ item, index }: { item: any; index: number }) => {
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.halfCard,
          { marginLeft: 0 }
        ]}
        onPress={async () => {
          if (isGeocoding) return; // Prevent multiple clicks during geocoding
          
          setIsGeocoding(item.name);
          
          try {
            logger.debug('Navigating to saved location detail:', item.name);
            
            // Get user ID for navigation
            const user = await getUserFromStorage();
            const userId = user?._id || 'current-user';
            
            // Convert location name to slug format
            const locationSlug = item.name.toLowerCase().replace(/\s+/g, '-');
            
            // Navigate to location detail page first
            router.push({
              pathname: '/tripscore/countries/[country]/locations/[location]',
              params: {
                country: 'general',
                location: locationSlug,
                userId: userId,
              }
            });
          } catch (error) {
            logger.error('Error navigating to saved location', error);
          } finally {
            setIsGeocoding(null);
          }
        }}
      >
        <Image 
          source={{ uri: item.imageUrl }} 
          style={styles.cardImage}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.cardGradient}
        />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{item.name}</Text>
        </View>
        {/* Loading indicator for geocoding */}
        {isGeocoding === item.name && (
          <View style={styles.loadingIndicator}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}
        {/* Saved indicator */}
        <View style={styles.savedIndicator}>
          <Ionicons name="bookmark" size={16} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="location-outline" size={60} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Locations Yet</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        Start exploring and discover amazing places around the world
      </Text>
      <TouchableOpacity 
        style={[styles.exploreButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/(tabs)/home')}
      >
        <Text style={styles.exploreButtonText}>Start Exploring</Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptySavedState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="bookmark-outline" size={60} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Saved Locations</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        Bookmark locations you love to find them here later
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar 
        barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
        backgroundColor={theme.colors.background} 
      />
      
      {/* Elegant Top Navigation */}
      <View style={[styles.topNavigation, { backgroundColor: theme.colors.background, borderBottomColor: theme.colors.border }]}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'locale' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('locale')}
          >
            <Ionicons 
              name="location-outline" 
              size={18} 
              color={activeTab === 'locale' ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'locale' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              LOCALE
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[
              styles.tabButton, 
              activeTab === 'saved' && [styles.activeTab, { backgroundColor: theme.colors.primary }]
            ]}
            onPress={() => setActiveTab('saved')}
          >
            <Ionicons 
              name="bookmark-outline" 
              size={18} 
              color={activeTab === 'saved' ? '#FFFFFF' : theme.colors.textSecondary} 
            />
            <Text style={[
              styles.tabText, 
              { color: activeTab === 'saved' ? '#FFFFFF' : theme.colors.textSecondary }
            ]}>
              SAVED
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {activeTab === 'locale' ? (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4A90E2']}
              tintColor="#4A90E2"
            />
          }
        >
          {renderCustomLayout()}
        </ScrollView>
      ) : (
        <FlatList
          data={savedLocations}
          renderItem={renderSavedLocationCard}
          keyExtractor={(item) => item.id || `saved-${item.slug || item.name}`}
          ListEmptyComponent={savedLocations.length === 0 ? renderEmptySavedState() : null}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadSavedLocations();
                setRefreshing(false);
              }}
            />
          }
          numColumns={2}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          columnWrapperStyle={styles.row}
        />
      )}

      {/* Filter Modal */}
      {renderFilterModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topNavigation: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: 6,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 3,
  },
  activeTab: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 0,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '400',
  },
  filterButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  listContainer: {
    paddingHorizontal: 12,
    paddingBottom: 30,
  },
  row: {
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  firstRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  locationCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  halfCard: {
    width: (width - 36) / 2,
    height: 180,
  },
  wideCard: {
    width: width - 24,
    height: 180,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    color: '#2C5530',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  markerOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    zIndex: 1,
  },
  cardGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  cardContent: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  savedIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  loadingIndicator: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyDescription: {
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 32,
  },
  exploreButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  savedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  savedText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },
  // Filter Modal Styles
  filterModalContainer: {
    flex: 1,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  placeholder: {
    width: 40,
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  filterScrollContent: {
    paddingBottom: 20,
  },
  filterSection: {
    marginTop: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  dropdownIconContainer: {
    marginLeft: 12,
  },
  dropdownList: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 200,
    zIndex: 1000,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownScrollView: {
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  dropdownItemText: {
    fontSize: 16,
    flex: 1,
  },
  spotTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotTypeText: {
    fontSize: 16,
    flex: 1,
  },
  radiusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    minHeight: 56,
  },
  radiusInput: {
    fontSize: 16,
    flex: 1,
  },
  radiusUnit: {
    fontSize: 16,
    marginLeft: 8,
    fontWeight: '500',
  },
  filterFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
  },
  searchButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

