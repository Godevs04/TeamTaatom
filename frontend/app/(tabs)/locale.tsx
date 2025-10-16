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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getProfile } from '../../services/profile';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';
import WorldMap from '../../components/WorldMap';
import AnimatedHeader from '../../components/AnimatedHeader';

interface LocationData {
  latitude: number;
  longitude: number;
  address: string;
  date: string;
  postId?: string;
}

export default function LocaleScreen() {
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const { theme, mode } = useTheme();
  const router = useRouter();

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

  const renderLocationItem = ({ item }: { item: LocationData }) => (
    <TouchableOpacity 
      style={[styles.locationItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => {
        setSelectedLocation(item);
        setShowMap(true);
      }}
    >
      <View style={styles.locationIcon}>
        <Ionicons name="location-outline" size={24} color={theme.colors.primary} />
      </View>
      <View style={styles.locationInfo}>
        <Text style={[styles.locationAddress, { color: theme.colors.text }]} numberOfLines={2}>
          {item.address}
        </Text>
        <Text style={[styles.locationDate, { color: theme.colors.textSecondary }]}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
        <Text style={[styles.locationCoords, { color: theme.colors.textSecondary }]}>
          {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="map-outline" size={60} color={theme.colors.textSecondary} />
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Locations Yet</Text>
      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
        Start posting photos with location to see them on your world map
      </Text>
      <TouchableOpacity 
        style={[styles.createPostButton, { backgroundColor: theme.colors.primary }]}
        onPress={() => router.push('/(tabs)/post')}
      >
        <Text style={styles.createPostButtonText}>Create Your First Post</Text>
      </TouchableOpacity>
    </View>
  );


  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
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
      
      {/* Elegant Header */}
      <AnimatedHeader 
        rightComponent={
          <View style={styles.headerActions}>
            {locations.length > 0 && (
              <TouchableOpacity 
                style={styles.mapButton}
                onPress={() => setShowMap(true)}
              >
                <Ionicons name="map-outline" size={20} color={theme.colors.text} />
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Stats */}
      {locations.length > 0 && (
        <View style={[styles.statsContainer, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>{locations.length}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Locations</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {new Set(locations.map(loc => `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`)).size}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Unique Places</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {new Set(locations.map(loc => new Date(loc.date).getFullYear())).size}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>Years</Text>
          </View>
        </View>
      )}

      {/* Locations List */}
      <FlatList
        data={locations}
        renderItem={renderLocationItem}
        keyExtractor={(item, index) => `${item.latitude}-${item.longitude}-${index}`}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={locations.length === 0 ? styles.emptyListContainer : undefined}
      />

      {/* World Map Modal */}
      <WorldMap
        visible={showMap}
        locations={locations}
        onClose={() => setShowMap(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  createPostButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createPostButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyListContainer: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 144, 226, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationDate: {
    fontSize: 14,
    marginBottom: 2,
  },
  locationCoords: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
