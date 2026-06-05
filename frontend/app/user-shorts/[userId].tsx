import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import logger from '../../utils/logger';
import { ErrorBoundary } from '../../utils/errorBoundary';
import Shorts from '../(tabs)/shorts';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';

function normalizeParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Dedicated full-screen shorts viewer for any user (same UX as opening from your own profile).
 * Uses Shorts with scopedUserId so the feed is that user’s shorts only.
 */
export default function UserShortsScreen() {
  const { userId, shortId, index } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<{ fullName?: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const uid = normalizeParam(userId as string | string[] | undefined);
  const sid = normalizeParam(shortId as string | string[] | undefined);
  const idx = index ? parseInt(normalizeParam(index as string | string[] | undefined) || '0', 10) : undefined;

  const fetchProfileForTitle = useCallback(async () => {
    if (!uid) return;
    try {
      const userResponse = await api.get(`/profile/${uid}`);
      setUser(userResponse.data.profile);
    } catch (error) {
      logger.error('Error fetching user for shorts header:', error);
    }
  }, [uid]);

  useEffect(() => {
    fetchProfileForTitle();
  }, [fetchProfileForTitle]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      ...(isWeb && {
        maxWidth: isTablet ? 600 : 500,
        alignSelf: 'center',
        width: '100%',
      } as object),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: '#000000',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
      zIndex: 10,
    },
    backButton: {
      padding: theme.spacing.xs,
      marginRight: theme.spacing.sm,
    },
    headerTitle: {
      fontSize: theme.typography.h3.fontSize,
      fontWeight: '600',
      color: '#ffffff',
      flex: 1,
    },
    muteButton: {
      padding: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
    },
    shortsFlex: {
      flex: 1,
    },
  });

  if (!uid) {
    return (
      <ErrorBoundary level="route">
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Shorts</Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <Text style={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
              Missing user. Go back and try again.
            </Text>
          </View>
        </SafeAreaView>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary level="route">
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {user?.fullName ? `${user.fullName}'s Shorts` : 'Shorts'}
          </Text>
          <TouchableOpacity
            style={styles.muteButton}
            onPress={() => setIsMuted(prev => !prev)}
            activeOpacity={0.7}
          >
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <View style={styles.shortsFlex}>
          <Shorts 
            scopedUserId={uid} 
            initialShortId={sid} 
            initialIndex={idx}
            isMuted={isMuted} 
            onMuteToggle={() => setIsMuted(prev => !prev)} 
          />
        </View>
      </SafeAreaView>
    </ErrorBoundary>
  );
}
