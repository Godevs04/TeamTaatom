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
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  postId?: string;
  imageUrl?: string;
}

// Mock data for beautiful location cards
const mockLocations = [
  {
    id: '1',
    name: 'BRISTOL',
    imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&h=300&fit=crop',
    type: 'city',
    description: 'Historic city with stunning suspension bridge',
  },
  {
    id: '2',
    name: 'SNOW HILL',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    type: 'mountain',
    description: 'Majestic mountain peak with snow-capped views',
  },
  {
    id: '3',
    name: 'B.VILLAGE',
    imageUrl: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=400&h=300&fit=crop',
    type: 'village',
    description: 'Charming countryside village',
  },
  {
    id: '4',
    name: 'RIVER SPOT',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Peaceful riverside location',
  },
  {
    id: '5',
    name: 'MOUNTAIN VIEW',
    imageUrl: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=400&h=300&fit=crop',
    type: 'mountain',
    description: 'Breathtaking mountain landscape',
  },
  {
    id: '6',
    name: 'LAKE POINT',
    imageUrl: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Serene lake surrounded by nature',
  },
  {
    id: '7',
    name: 'SUNRISE PEAK',
    imageUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=300&fit=crop',
    type: 'mountain',
    description: 'Perfect spot for sunrise views',
  },
  {
    id: '8',
    name: 'FOREST TRAIL',
    imageUrl: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Peaceful forest walking trail',
  },
];

// Mock data for saved locations
const mockSavedLocations = [
  {
    id: 's1',
    name: 'LAKE POINT',
    imageUrl: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Serene lake surrounded by lush green trees',
    savedDate: '2024-01-15',
  },
  {
    id: 's2',
    name: 'MOUNTAIN VIEW',
    imageUrl: 'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?w=400&h=300&fit=crop',
    type: 'mountain',
    description: 'Majestic mountain range at sunset',
    savedDate: '2024-01-14',
  },
  {
    id: 's3',
    name: 'SUNRISE POINT',
    imageUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Misty mountain landscape at sunrise',
    savedDate: '2024-01-13',
  },
  {
    id: 's4',
    name: 'RIVER ROAD',
    imageUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
    type: 'nature',
    description: 'Tranquil river lined with tall trees',
    savedDate: '2024-01-12',
  },
  {
    id: 's5',
    name: 'STONE BRIDGE',
    imageUrl: 'https://images.unsplash.com/photo-1511497584788-876760111969?w=400&h=300&fit=crop',
    type: 'historical',
    description: 'Picturesque stone bridge over calm river',
    savedDate: '2024-01-11',
  },
  {
    id: 's6',
    name: 'MOUNTAIN CABIN',
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
    type: 'village',
    description: 'Charming wooden cabin on hillside',
    savedDate: '2024-01-10',
  },
];

interface FilterState {
  country: string;
  stateProvince: string;
  spotTypes: string[];
  searchRadius: string;
}

export default function LocaleScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'locale' | 'saved'>('locale');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    country: 'United Kingdom',
    stateProvince: 'Bristol',
    spotTypes: [],
    searchRadius: '',
  });
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
  }, []);

  const loadUserLocations = async () => {
    try {
      setLoading(true);
      const user = await getUserFromStorage();
      if (!user) {
        Alert.alert('Error', 'Please sign in to view your locations');
        router.push('/(auth)/signin');
        return;
      }

      const response = await getProfile(user._id);
      setLocations(response.profile.locations || []);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load locations');
      console.error('Failed to fetch locations:', error);
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
    setFilters(prev => ({
      ...prev,
      spotTypes: prev.spotTypes.includes(spotType)
        ? prev.spotTypes.filter(type => type !== spotType)
        : [...prev.spotTypes, spotType]
    }));
  };

  const handleSearch = () => {
    console.log('Searching with filters:', filters);
    setShowFilterModal(false);
    // Implement search logic here
  };

  const renderFilterModal = () => (
    <Modal
      visible={showFilterModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.filterModalContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        
        {/* Header */}
        <View style={styles.filterHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => setShowFilterModal(false)}
          >
            <Ionicons name="chevron-back" size={24} color="#000000" />
          </TouchableOpacity>
          <Text style={styles.filterTitle}>FILTER</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.filterContent} showsVerticalScrollIndicator={false}>
          {/* Country */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>COUNTRY</Text>
            <TouchableOpacity style={styles.dropdownField}>
              <Text style={styles.dropdownText}>{filters.country}</Text>
              <Ionicons name="chevron-down" size={20} color="#999999" />
            </TouchableOpacity>
          </View>

          {/* State/Province */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>STATE/PROVINCE</Text>
            <TouchableOpacity style={styles.dropdownField}>
              <Text style={styles.dropdownText}>{filters.stateProvince}</Text>
              <Ionicons name="chevron-down" size={20} color="#999999" />
            </TouchableOpacity>
          </View>

          {/* Type of Spot */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>TYPE OF SPOT</Text>
            {spotTypeOptions.map((spotType, index) => (
              <TouchableOpacity
                key={index}
                style={styles.spotTypeOption}
                onPress={() => toggleSpotType(spotType)}
              >
                <View style={[
                  styles.checkbox,
                  filters.spotTypes.includes(spotType) && styles.checkboxSelected
                ]}>
                  {filters.spotTypes.includes(spotType) && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.spotTypeText}>{spotType}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Search Radius */}
          <View style={styles.filterSection}>
            <Text style={styles.filterSectionTitle}>SEARCH RADIUS</Text>
            <TextInput
              style={styles.radiusInput}
              placeholder="Enter radius in km"
              placeholderTextColor="#999999"
              value={filters.searchRadius}
              onChangeText={(text) => setFilters(prev => ({ ...prev, searchRadius: text }))}
              keyboardType="numeric"
            />
          </View>
        </ScrollView>

        {/* Search Button */}
        <View style={styles.filterFooter}>
          <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderLocationCard = ({ item, index }: { item: any; index: number }) => {
    // First two cards (BRISTOL, SNOW HILL) are half cards, all others are wide cards
    const isWideCard = index >= 2;
    
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          isWideCard ? styles.wideCard : styles.halfCard,
          { marginLeft: 0 }
        ]}
        onPress={() => {
          // Navigate to location details
          console.log('Navigate to:', item.name);
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
      </TouchableOpacity>
    );
  };

  const renderCustomLayout = () => {
    return (
      <View style={styles.listContainer}>
        {/* First row - two half cards side by side */}
        <View style={styles.firstRow}>
          {renderLocationCard({ item: mockLocations[0], index: 0 })}
          {renderLocationCard({ item: mockLocations[1], index: 1 })}
        </View>
        
        {/* Rest of the cards - all wide cards */}
        {mockLocations.slice(2).map((item, index) => (
          <View key={item.id}>
            {renderLocationCard({ item, index: index + 2 })}
          </View>
        ))}
      </View>
    );
  };

  const renderSavedLocationCard = ({ item, index }: { item: any; index: number }) => {
    return (
      <TouchableOpacity 
        style={[
          styles.locationCard,
          styles.halfCard,
          { marginLeft: 0 }
        ]}
        onPress={() => {
          // Navigate to saved location details
          console.log('Navigate to saved:', item.name);
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
          data={mockSavedLocations}
          renderItem={renderSavedLocationCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4A90E2']}
              tintColor="#4A90E2"
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={60} color={theme.colors.textSecondary} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Saved Locations</Text>
              <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
                Start exploring and save your favorite places
              </Text>
              <TouchableOpacity 
                style={[styles.exploreButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => setActiveTab('locale')}
              >
                <Text style={styles.exploreButtonText}>Explore Locations</Text>
              </TouchableOpacity>
            </View>
          )}
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
    backgroundColor: '#FFFFFF',
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: 'serif',
  },
  placeholder: {
    width: 40,
  },
  filterContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filterSection: {
    marginTop: 24,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  dropdownText: {
    fontSize: 16,
    color: '#000000',
  },
  spotTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    backgroundColor: '#F8F9FA',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  spotTypeText: {
    fontSize: 16,
    color: '#000000',
  },
  radiusInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    fontSize: 16,
    color: '#000000',
  },
  filterFooter: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  searchButton: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
});
