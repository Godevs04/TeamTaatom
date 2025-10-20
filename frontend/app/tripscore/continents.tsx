import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

interface Continent {
  name: string;
  score: number;
  distance: number;
}

interface TripScoreContinentsResponse {
  success: boolean;
  totalScore: number;
  continents: Continent[];
}

export default function TripScoreContinentsScreen() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TripScoreContinentsResponse | null>(null);
  const { theme } = useTheme();
  const router = useRouter();
  const { userId } = useLocalSearchParams();

  useEffect(() => {
    loadContinents();
  }, []);

  const loadContinents = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/profile/${userId}/tripscore/continents`);
      setData(response.data);
    } catch (error) {
      console.error('Error loading continents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContinentPress = (continent: string) => {
    const continentSlug = continent.toLowerCase().replace(/\s+/g, '-');
    router.push(`/tripscore/continents/${continentSlug}/countries?userId=${userId}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.surface }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          TripScore
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {data && (
          <>
            {/* Total Score */}
            <View style={[styles.totalScoreContainer, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.totalScoreNumber, { color: theme.colors.primary }]}>
                {data.totalScore}
              </Text>
              <Text style={[styles.totalScoreLabel, { color: theme.colors.textSecondary }]}>
                Total TripScore
              </Text>
            </View>

            {/* Continents List */}
            <View style={[styles.continentsContainer, { backgroundColor: theme.colors.surface }]}>
              {data.continents.map((continent, index) => (
                <TouchableOpacity
                  key={continent.name}
                  style={[
                    styles.continentItem,
                    { backgroundColor: theme.colors.surface },
                    index === data.continents.length - 1 && styles.lastItem
                  ]}
                  onPress={() => handleContinentPress(continent.name)}
                >
                  <View style={styles.continentContent}>
                    <Text style={[styles.continentName, { color: theme.colors.text }]}>
                      {continent.name}
                    </Text>
                    <Text style={[styles.continentScoreLabel, { color: theme.colors.textSecondary }]}>
                      TRIPSCORE
                    </Text>
                    <Text style={[styles.continentScoreValue, { color: theme.colors.primary }]}>
                      {continent.score.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={styles.continentRight}>
                    <Text style={[styles.continentDistance, { color: theme.colors.textSecondary }]}>
                      {continent.distance} km
                    </Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  totalScoreContainer: {
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  totalScoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  totalScoreLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  continentsContainer: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    overflow: 'hidden',
  },
  continentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  continentContent: {
    flex: 1,
  },
  continentName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  continentScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  continentScoreValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  continentRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  continentDistance: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
});
