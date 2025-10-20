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
  Share,
  Platform,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, toggleLike, addComment, getPostById } from '../../services/posts';
import { toggleFollow } from '../../services/profile';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { savedEvents } from '../../utils/savedEvents';
import CommentModal from '../../components/CommentModal';

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
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [selectedShortId, setSelectedShortId] = useState<string | null>(null);
  const [selectedShortComments, setSelectedShortComments] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [followStates, setFollowStates] = useState<{ [key: string]: boolean }>({});
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const { theme, mode } = useTheme();
  const router = useRouter();
  const { showSuccess, showError, showInfo, showWarning } = useAlert();

  useEffect(() => {
    loadShorts();
    loadCurrentUser();
    loadSavedShorts();
  }, []);

  const loadSavedShorts = async () => {
    try {
      const stored = await AsyncStorage.getItem('savedShorts');
      const arr = stored ? JSON.parse(stored) : [];
      setSavedShorts(new Set(Array.isArray(arr) ? arr : []));
    } catch {}
  };

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
          videoRef.unloadAsync();
        }
      });
      
      // Clear all timeouts
      Object.values(pauseTimeoutRefs.current).forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
    };
  }, []);

  // Pause all videos when current index changes
  useEffect(() => {
    // Pause all videos first
    Object.values(videoRefs.current).forEach((videoRef) => {
      if (videoRef) {
        videoRef.pauseAsync();
        videoRef.setIsMutedAsync(true); // Mute all videos
      }
    });
    
    // Play and unmute only the current video
    const currentVideoRef = videoRefs.current[shorts[currentIndex]?._id];
    if (currentVideoRef) {
      currentVideoRef.playAsync();
      currentVideoRef.setIsMutedAsync(false); // Unmute current video
    }
    
    // Unload videos that are far from current view for memory optimization
    shorts.forEach((short, index) => {
      const videoRef = videoRefs.current[short._id];
      const distanceFromCurrent = Math.abs(index - currentIndex);
      
      if (distanceFromCurrent > 2 && videoRef) {
        // Unload videos that are more than 2 positions away
        videoRef.unloadAsync();
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
      
      // Initialize follow states for each short
      const initialFollowStates: { [key: string]: boolean } = {};
      response.shorts?.forEach((short: PostType) => {
        // Check if the user object has isFollowing property
        const userWithFollowStatus = short.user as any;
        const followStatus = userWithFollowStatus.isFollowing || false;
        initialFollowStates[short.user._id] = followStatus;
      });
      setFollowStates(initialFollowStates);
      
    } catch (error: any) {
      console.error('Failed to fetch shorts:', error);
      showError('Failed to load shorts. Please try again.');
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

  // Handle like/unlike with enhanced feedback
  const handleLike = async (shortId: string) => {
    if (!currentUser) {
      showError('You must be signed in to like shorts');
      return;
    }

    try {
      setActionLoading('like');
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
      
      if (response.isLiked) {
        // showSuccess('Liked! ❤️');
        console.log('Short liked ❤️ :', shortId);
      }
    } catch (error: any) {
      console.error('Error toggling like:', error);
      showError('Failed to update like. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle comment with enhanced modal
  const handleComment = async (shortId: string) => {
    if (!currentUser) {
      showError('You must be signed in to comment');
      return;
    }
    
    try {
      // First try to get comments from the shorts list
      const selectedShort = shorts.find(short => short._id === shortId);
      let comments = selectedShort?.comments || [];
      
      // If no comments found, try to fetch fresh data from API
      if (comments.length === 0) {
        try {
          const response = await getPostById(shortId);
          comments = response.post?.comments || [];
        } catch (apiError) {
          console.log('Could not fetch fresh comments, using cached data');
        }
      }
      
      setSelectedShortComments(comments);
      setSelectedShortId(shortId);
      setShowCommentModal(true);
    } catch (error) {
      console.error('Error loading comments:', error);
      showError('Failed to load comments');
    }
  };

  // Handle comment added
  const handleCommentAdded = (newComment: any) => {
    // Update the shorts list to reflect new comment count
    setShorts(prev => prev.map(short => 
      short._id === selectedShortId 
        ? { 
            ...short, 
            commentsCount: (short.commentsCount || 0) + 1,
            comments: [...(short.comments || []), newComment]
          }
        : short
    ));
    
    // Update the selected short comments for the modal
    setSelectedShortComments(prev => [...prev, newComment]);
    
    // Don't show success alert here - let the modal handle it
    console.log('Comment added to shorts list');
  };

  // Handle share with enhanced functionality
  const handleShare = async (short: PostType) => {
    try {
      const shareContent = {
        title: `Short by ${short.user.fullName}`,
        message: `${short.caption}\n\nCheck out this amazing short!`,
        url: short.mediaUrl || short.imageUrl,
      };

      if (Platform.OS === 'ios') {
        await Share.share(shareContent);
      } else {
        await Share.share(shareContent);
      }
      // Log success instead of showing a custom alert
      console.log('Short shared successfully:', short._id);
    } catch (error) {
      console.error('Error sharing:', error);
      showError('Failed to share. Please try again.');
    }
  };

  // Handle save/bookmark with enhanced feedback
  const handleSave = (shortId: string) => {
    if (!currentUser) {
      showError('You must be signed in to save shorts');
      return;
    }

    setSavedShorts(prev => {
      const newSaved = new Set(prev);
      if (newSaved.has(shortId)) {
        newSaved.delete(shortId);
        // Log instead of alert
        console.log('Short removed from saved:', shortId);
      } else {
        newSaved.add(shortId);
        // Log instead of alert
        console.log('Short saved:', shortId);
      }
      // Persist to AsyncStorage so profile Saved tab can read it
      try {
        const arr = Array.from(newSaved);
        AsyncStorage.setItem('savedShorts', JSON.stringify(arr));
        // notify saved tab to refresh immediately
        savedEvents.emitChanged();
      } catch {}
      return newSaved;
    });
  };

  // Handle follow/unfollow
  const handleFollow = async (userId: string, userName: string) => {
    if (!currentUser) {
      showError('You must be signed in to follow users');
      return;
    }

    if (currentUser._id === userId) {
      showInfo('You cannot follow yourself');
      return;
    }

    try {
      setActionLoading('follow');
      const response = await toggleFollow(userId);
      setFollowStates(prev => ({
        ...prev,
        [userId]: response.isFollowing
      }));
      
      showSuccess(
        response.isFollowing 
          ? `You're now following ${userName}` 
          : `You've unfollowed ${userName}`
      );
    } catch (error: any) {
      // Don't log conflict errors (follow request already pending) as they are expected
      if (!error.isConflict && error.response?.status !== 409) {
        console.error('Error toggling follow:', error);
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update follow status. Please try again.';
      
      // Check if it's a follow request already pending message or conflict error
      if (errorMessage.includes('Follow request already pending') || errorMessage.includes('Request already sent') || error.isConflict) {
        showWarning(errorMessage);
      } else {
        showError(errorMessage);
      }
    } finally {
      setActionLoading(null);
    }
  };

  // Handle profile navigation
  const handleProfilePress = (userId: string) => {
    if (currentUser && currentUser._id === userId) {
      // Navigate to own profile
      router.push('/(tabs)/profile');
    } else {
      // Navigate to other user's profile
      router.push(`/profile/${userId}`);
    }
  };

  const renderShortItem = ({ item, index }: { item: PostType; index: number }) => {
    const isVideoPlaying = videoStates[item._id] || index === currentIndex;
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);

    return (
      <View style={styles.shortItem}>
        {/* Video Player with Tap Gesture */}
        <TouchableWithoutFeedback 
          onPress={() => {
            toggleVideoPlayback(item._id);
            showPauseButtonTemporarily(item._id);
          }}
        >
          <Video
            ref={(ref) => {
              videoRefs.current[item._id] = ref;
            }}
            source={{ uri: item.mediaUrl || item.imageUrl }}
            style={styles.shortVideo}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isVideoPlaying}
            isLooping
            isMuted={index !== currentIndex} // Mute all videos except current
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
        
        {/* Gradient Overlay for better text readability */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
          style={styles.gradientOverlay}
        />
        
        {/* Play/Pause Overlay - Only show when paused or temporarily after interaction */}
        {(showPauseButton[item._id] || !videoStates[item._id]) && (
          <View style={styles.playButton}>
            <View style={styles.playButtonBackground}>
              <Ionicons 
                name={videoStates[item._id] ? "pause" : "play"} 
                size={60} 
                color="white" 
              />
            </View>
          </View>
        )}
      
        {/* Right Side Action Buttons */}
        <View style={styles.rightActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLike(item._id)}
            disabled={actionLoading === 'like'}
          >
            <View style={styles.actionButtonContainer}>
              <Ionicons 
                name={item.isLiked ? "heart" : "heart-outline"} 
                size={32} 
                color={item.isLiked ? "#ff3040" : "white"} 
              />
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleComment(item._id)}
          >
            <View style={styles.actionButtonContainer}>
              <Ionicons name="chatbubble-outline" size={32} color="white" />
              <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleShare(item)}
          >
            <View style={styles.actionButtonContainer}>
              <Ionicons name="paper-plane-outline" size={32} color="white" />
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSave(item._id)}
          >
            <View style={styles.actionButtonContainer}>
              <Ionicons 
                name={isSaved ? "bookmark" : "bookmark-outline"} 
                size={32} 
                color={isSaved ? "#4A90E2" : "white"} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Bottom Content with Enhanced Design */}
        <View style={styles.bottomContent}>
          {/* User Info */}
          <View style={styles.userInfo}>
            <TouchableOpacity onPress={() => handleProfilePress(item.user._id)}>
              <Image 
                source={{ uri: item.user.profilePic || 'https://via.placeholder.com/40' }} 
                style={styles.userAvatar} 
              />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.userDetails}
              onPress={() => handleProfilePress(item.user._id)}
            >
              <Text style={styles.userName}>{item.user.fullName}</Text>
              {/* <Text style={styles.userHandle}>{item.user.fullName.toLowerCase().replace(/\s+/g, '')}</Text> */}
            </TouchableOpacity>
            {/* Only show follow button if not own user */}
            {currentUser && currentUser._id !== item.user._id && (
              <TouchableOpacity 
                style={[
                  styles.followButton,
                  { backgroundColor: isFollowing ? 'rgba(255,255,255,0.2)' : '#4A90E2' }
                ]}
                onPress={() => handleFollow(item.user._id, item.user.fullName)}
                disabled={actionLoading === 'follow'}
              >
                {actionLoading === 'follow' ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.followButtonText}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Caption */}
          <View style={styles.captionContainer}>
            <Text style={styles.caption} numberOfLines={3}>{item.caption}</Text>
          </View>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {item.tags.slice(0, 3).map((tag, tagIndex) => (
                <Text key={tagIndex} style={styles.tag}>#{tag}</Text>
              ))}
            </View>
          )}

          {/* Location */}
          {item.location?.address && (
            <View style={styles.locationContainer}>
              <Ionicons name="location-outline" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.locationText} numberOfLines={1}>{item.location.address}</Text>
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
          <View style={styles.loadingContent}>
            <Ionicons name="videocam" size={60} color="#4A90E2" />
            <Text style={styles.loadingTitle}>Loading Shorts</Text>
            <Text style={styles.loadingSubtitle}>Discover amazing content...</Text>
            <ActivityIndicator size="large" color="#4A90E2" style={styles.loadingSpinner} />
          </View>
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
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
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

      {/* Comment Modal */}
      {selectedShortId && (
        <CommentModal
          postId={selectedShortId}
          visible={showCommentModal}
          comments={selectedShortComments}
          onClose={() => {
            setShowCommentModal(false);
            setSelectedShortId(null);
            setSelectedShortComments([]);
          }}
          onCommentAdded={handleCommentAdded}
        />
      )}
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
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 24,
  },
  loadingSpinner: {
    marginTop: 16,
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
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 1,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -40 }, { translateY: -40 }],
    zIndex: 10,
  },
  playButtonBackground: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 40,
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 180,
    alignItems: 'center',
    zIndex: 5,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 28,
  },
  actionButtonContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 25,
    padding: 8,
    minWidth: 50,
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 60,
    zIndex: 5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingRight: 80, // Add padding to avoid overlap with action buttons
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'white',
    opacity: 0.9,
  },
  userDetails: {
    flex: 1,
    paddingVertical: 4,
  },
  userName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  userHandle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  captionContainer: {
    marginBottom: 12,
  },
  caption: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 8,
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginLeft: 4,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
