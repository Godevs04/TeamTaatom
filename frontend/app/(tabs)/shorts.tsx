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
  TouchableWithoutFeedback,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, toggleLike, addComment } from '../../services/posts';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';
// import * as Sharing from 'expo-sharing';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ShortsScreen() {
  const [shorts, setShorts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [videoStates, setVideoStates] = useState<{ [key: string]: boolean }>({});
  const [showPauseButton, setShowPauseButton] = useState<{ [key: string]: boolean }>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [savedShorts, setSavedShorts] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const { theme, mode } = useTheme();
  const router = useRouter();

  useEffect(() => {
    loadShorts();
    loadCurrentUser();
  }, []);

  const loadCurrentUser = async () => {
    try {
      const user = await getUserFromStorage();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  // Cleanup videos when component unmounts
  useEffect(() => {
    return () => {
      Object.values(videoRefs.current).forEach((videoRef) => {
        if (videoRef) {
          videoRef.pauseAsync();
        }
      });
    };
  }, []);

  // Pause all videos when current index changes
  useEffect(() => {
    Object.values(videoRefs.current).forEach((videoRef) => {
      if (videoRef) {
        videoRef.pauseAsync();
      }
    });
    
    // Update video states
    const newVideoStates: { [key: string]: boolean } = {};
    shorts.forEach((short, index) => {
      newVideoStates[short._id] = index === currentIndex;
    });
    setVideoStates(newVideoStates);
  }, [currentIndex, shorts]);

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

  const toggleVideoPlayback = (itemId: string) => {
    const videoRef = videoRefs.current[itemId];
    const isCurrentlyPlaying = videoStates[itemId];
    
    if (isCurrentlyPlaying) {
      videoRef?.pauseAsync();
    } else {
      videoRef?.playAsync();
    }
  };

  // Show pause button temporarily
  const showPauseButtonTemporarily = (itemId: string) => {
    setShowPauseButton(prev => ({ ...prev, [itemId]: true }));
    
    // Clear existing timeout
    if (pauseTimeoutRefs.current[itemId]) {
      clearTimeout(pauseTimeoutRefs.current[itemId]);
    }
    
    // Hide after 2 seconds
    pauseTimeoutRefs.current[itemId] = setTimeout(() => {
      setShowPauseButton(prev => ({ ...prev, [itemId]: false }));
    }, 2000);
  };

  // Handle like/unlike
  const handleLike = async (shortId: string) => {
    try {
      const response = await toggleLike(shortId);
      setShorts(prev => prev.map(short => 
        short._id === shortId 
          ? { 
              ...short, 
              isLiked: response.isLiked, 
              likesCount: response.likesCount 
            }
          : short
      ));
    } catch (error) {
      console.error('Error toggling like:', error);
      Alert.alert('Error', 'Failed to update like');
    }
  };

  // Handle comment
  const handleComment = (shortId: string) => {
    Alert.prompt(
      'Add Comment',
      'Write your comment:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Post',
          onPress: async (commentText: string | undefined) => {
            if (commentText && commentText.trim()) {
              try {
                await addComment(shortId, commentText.trim());
                // Refresh shorts to get updated comment count
                loadShorts();
                Alert.alert('Success', 'Comment added successfully');
              } catch (error) {
                console.error('Error adding comment:', error);
                Alert.alert('Error', 'Failed to add comment');
              }
            }
          }
        }
      ],
      'plain-text'
    );
  };

  // Handle share
  const handleShare = async (short: PostType) => {
    try {
      const shareUrl = `Check out this short by ${short.user.fullName}: ${short.caption}`;
      // For now, just show an alert. In production, you can use expo-sharing
      Alert.alert('Share', shareUrl);
    } catch (error) {
      console.error('Error sharing:', error);
      Alert.alert('Error', 'Failed to share');
    }
  };

  // Handle save/bookmark
  const handleSave = (shortId: string) => {
    setSavedShorts(prev => {
      const newSaved = new Set(prev);
      if (newSaved.has(shortId)) {
        newSaved.delete(shortId);
        Alert.alert('Removed', 'Short removed from saved');
      } else {
        newSaved.add(shortId);
        Alert.alert('Saved', 'Short saved to your collection');
      }
      return newSaved;
    });
  };

  const renderShortItem = ({ item, index }: { item: PostType; index: number }) => {
    const isVideoPlaying = videoStates[item._id] || index === currentIndex;

    return (
      <View style={styles.shortItem}>
        {/* Video Player with Tap Gesture */}
        <TouchableWithoutFeedback onPress={() => showPauseButtonTemporarily(item._id)}>
          <Video
            ref={(ref) => {
              videoRefs.current[item._id] = ref;
            }}
            source={{ uri: item.mediaUrl || item.imageUrl }}
            style={styles.shortVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isVideoPlaying}
            isLooping
            isMuted={false}
            onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
              if (status.isLoaded) {
                setVideoStates(prev => ({
                  ...prev,
                  [item._id]: status.isPlaying
                }));
              }
            }}
          />
        </TouchableWithoutFeedback>
        
        {/* Play/Pause Overlay - Only show when paused or temporarily after interaction */}
        {(showPauseButton[item._id] || !isVideoPlaying) && (
          <TouchableOpacity 
            style={styles.playButton}
            onPress={() => {
              toggleVideoPlayback(item._id);
              showPauseButtonTemporarily(item._id);
            }}
          >
            <Ionicons 
              name={isVideoPlaying ? "pause" : "play"} 
              size={60} 
              color="rgba(255,255,255,0.8)" 
            />
          </TouchableOpacity>
        )}
      
      {/* Right Side Action Buttons */}
      <View style={styles.rightActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleLike(item._id)}
        >
          <Ionicons 
            name={item.isLiked ? "heart" : "heart-outline"} 
            size={28} 
            color={item.isLiked ? "#ff3040" : "white"} 
          />
          <Text style={styles.actionText}>{item.likesCount || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleComment(item._id)}
        >
          <Ionicons name="chatbubble-outline" size={28} color="white" />
          <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleShare(item)}
        >
          <Ionicons name="share-outline" size={28} color="white" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleSave(item._id)}
        >
          <Ionicons 
            name={savedShorts.has(item._id) ? "bookmark" : "bookmark-outline"} 
            size={28} 
            color={savedShorts.has(item._id) ? "#4A90E2" : "white"} 
          />
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
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="black" 
          translucent
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="white" />
        </View>
      </View>
    );
  }

  if (shorts.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="black" 
          translucent
        />
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={80} color="rgba(255,255,255,0.6)" />
          <Text style={[styles.emptyTitle, { color: 'white' }]}>No Shorts Yet</Text>
          <Text style={[styles.emptyDescription, { color: 'rgba(255,255,255,0.6)' }]}>
            Create your first short video to share with your followers and start building your audience!
          </Text>
          <TouchableOpacity 
            style={[styles.createShortButton, { backgroundColor: '#4A90E2' }]}
            onPress={() => router.push('/(tabs)/post')}
          >
            <Text style={styles.createShortButtonText}>Create Short</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="black" 
        translucent
      />

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
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
  shortVideo: {
    width: '100%',
    height: '100%',
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
