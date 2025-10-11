import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getShorts } from '../../services/posts';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ShortsScreen() {
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const { theme, mode } = useTheme();
  const router = useRouter();

  useEffect(() => {
    loadShorts();
  }, []);

  const loadShorts = async () => {
    try {
      setLoading(true);
      const response = await getShorts(1, 50); // Load shorts specifically
      setShorts(response.shorts || []);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load shorts');
      console.error('Failed to fetch shorts:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderShortItem = ({ item, index }: { item: PostType; index: number }) => (
    <View style={styles.shortItem}>
      {/* Video Thumbnail/Poster */}
      <Image source={{ uri: item.imageUrl }} style={styles.shortImage} />
      
      {/* Play/Pause Overlay */}
      <TouchableOpacity 
        style={styles.playButton}
        onPress={() => setIsPlaying(!isPlaying)}
      >
        <Ionicons 
          name={isPlaying ? "pause" : "play"} 
          size={60} 
          color="rgba(255,255,255,0.8)" 
        />
      </TouchableOpacity>
      
      {/* Right Side Action Buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="heart-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.likesCount || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share-outline" size={28} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="bookmark-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Bottom Content */}
      <View style={styles.bottomContent}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: item.user.profilePic || 'https://via.placeholder.com/40' }} 
            style={styles.userAvatar} 
          />
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.user.fullName}</Text>
            <Text style={styles.userHandle}>@{item.user.fullName.toLowerCase().replace(/\s+/g, '')}</Text>
          </View>
          <TouchableOpacity style={styles.followButton}>
            <Text style={styles.followButtonText}>Follow</Text>
          </TouchableOpacity>
        </View>

        {/* Caption */}
        <View style={styles.captionContainer}>
          <Text style={styles.caption}>{item.caption}</Text>
        </View>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, tagIndex) => (
              <Text key={tagIndex} style={styles.tag}>#{tag}</Text>
            ))}
          </View>
        )}

        {/* Location */}
        {item.location?.address && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.locationText}>{item.location.address}</Text>
          </View>
        )}
      </View>
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

  if (shorts.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar 
          barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} 
          backgroundColor={theme.colors.background} 
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={60} color={theme.colors.textSecondary} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Shorts Yet</Text>
          <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
            Upload your first short video to get started!
          </Text>
          <TouchableOpacity 
            style={[styles.createShortButton, { backgroundColor: theme.colors.primary }]}
            onPress={() => router.push('/(tabs)/post')}
          >
            <Text style={styles.createShortButtonText}>Create Short</Text>
          </TouchableOpacity>
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
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Shorts</Text>
        <TouchableOpacity onPress={() => router.push('/chat')}>
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={shorts}
        renderItem={renderShortItem}
        keyExtractor={(item) => item._id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          setCurrentIndex(index);
        }}
        getItemLayout={(data, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
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
  createShortButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createShortButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  shortItem: {
    width: '100%',
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  shortImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -30 }],
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 24,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'white',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userHandle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  followButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  followButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  captionContainer: {
    marginBottom: 8,
  },
  caption: {
    color: 'white',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginLeft: 4,
  },
});
