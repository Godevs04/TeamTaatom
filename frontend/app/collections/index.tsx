import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAlert } from '../../context/AlertContext';
import { getCollections, Collection } from '../../services/collections';
import { getUserFromStorage } from '../../services/auth';
import EmptyState from '../../components/EmptyState';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { theme } from '../../constants/theme';
import logger from '../../utils/logger';

// Responsive dimensions
const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth >= 768;
const isWeb = Platform.OS === 'web';
const isIOS = Platform.OS === 'ios';
const isAndroid = Platform.OS === 'android';

// Elegant font families
const getFontFamily = (weight: '400' | '500' | '600' | '700' | '800' = '400') => {
  if (isWeb) return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  if (isIOS) return 'System';
  return 'Roboto';
};

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { theme } = useTheme();
  const { showError } = useAlert();
  const router = useRouter();

  const loadCollections = async () => {
    try {
      setLoading(true);
      const user = await getUserFromStorage();
      if (!user) {
        router.push('/(auth)/signin');
        return;
      }

      const response = await getCollections(user._id);
      setCollections(response.collections || []);
    } catch (error: any) {
      showError('Failed to load collections');
      logger.error('Error loading collections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadCollections();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCollections();
  };

  const renderCollection = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={[styles.collectionCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}
      onPress={() => router.push(`/collections/${item._id}`)}
    >
      {item.coverImage ? (
        <Image source={{ uri: item.coverImage }} style={styles.coverImage} />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: theme.colors.surfaceSecondary }]}>
          <Ionicons name="images-outline" size={40} color={theme.colors.textSecondary} />
        </View>
      )}
      <View style={styles.collectionInfo}>
        <Text style={[styles.collectionName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description && (
          <Text style={[styles.collectionDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        <View style={styles.collectionMeta}>
          <Ionicons name="image-outline" size={14} color={theme.colors.textSecondary} />
          <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
            {item.posts?.length || 0} {item.posts?.length === 1 ? 'post' : 'posts'}
          </Text>
          {!item.isPublic && (
            <>
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}> • </Text>
              <Ionicons name="lock-closed-outline" size={14} color={theme.colors.textSecondary} />
            </>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textSecondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingSkeleton />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Collections</Text>
        <TouchableOpacity 
          onPress={() => router.push('/collections/create')}
          style={styles.addButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {collections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            icon="albums-outline"
            title="No Collections"
            description="Create your first collection to organize your posts"
            actionLabel="Create Collection"
            onAction={() => router.push('/collections/create')}
          />
        </View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderCollection}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isTablet ? theme.spacing.xl : theme.spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.lg : 16),
    paddingTop: Platform.OS === 'ios' ? (isTablet ? theme.spacing.md : 12) : (isTablet ? theme.spacing.xl : 20),
    borderBottomWidth: 1,
    minHeight: isTablet ? 64 : 56,
  },
  backButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: Platform.OS === 'android' ? 48 : 44,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : 8,
    marginLeft: isTablet ? -theme.spacing.sm : -8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  addButton: {
    // Minimum touch target: 44x44 for iOS, 48x48 for Android
    minWidth: Platform.OS === 'android' ? 48 : 44,
    minHeight: Platform.OS === 'android' ? 48 : 44,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.sm : 8,
    marginRight: isTablet ? -theme.spacing.sm : -8,
    ...(Platform.OS === 'web' && {
      cursor: 'pointer',
      transition: 'all 0.2s ease',
    } as any),
  },
  headerTitle: {
    fontSize: isTablet ? 22 : 18,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    letterSpacing: isIOS ? 0.3 : 0.2,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: isTablet ? theme.spacing.xxl : 20,
  },
  list: {
    padding: isTablet ? theme.spacing.xl : theme.spacing.lg,
  },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: isTablet ? theme.spacing.md : 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    marginBottom: isTablet ? theme.spacing.md : 12,
  },
  coverImage: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: theme.borderRadius.sm,
    marginRight: isTablet ? theme.spacing.md : 12,
  },
  coverPlaceholder: {
    width: isTablet ? 80 : 60,
    height: isTablet ? 80 : 60,
    borderRadius: theme.borderRadius.sm,
    marginRight: isTablet ? theme.spacing.md : 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: isTablet ? theme.typography.body.fontSize + 2 : 16,
    fontFamily: getFontFamily('600'),
    fontWeight: '600',
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  collectionDescription: {
    fontSize: isTablet ? theme.typography.body.fontSize : 14,
    fontFamily: getFontFamily('400'),
    marginBottom: 4,
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
  collectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: isTablet ? 6 : 4,
  },
  metaText: {
    fontSize: isTablet ? theme.typography.small.fontSize + 1 : 12,
    fontFamily: getFontFamily('400'),
    ...(isWeb && {
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    } as any),
  },
});

