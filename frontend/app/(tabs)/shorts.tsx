import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { getShorts, toggleLike, addComment, getPostById, deleteShort } from '../../services/posts';
import { toggleFollow } from '../../services/profile';
import { PostType } from '../../types/post';
import { getUserFromStorage } from '../../services/auth';
import { useRouter } from 'expo-router';
import { useAlert } from '../../context/AlertContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import PostComments from '../../components/post/PostComments';
import { useScrollToHideNav } from '../../hooks/useScrollToHideNav';
import { createLogger } from '../../utils/logger';
import { trackScreenView, trackEngagement, trackPostView } from '../../services/analytics';
import SongPlayer from '../../components/SongPlayer';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const logger = createLogger('ShortsScreen');

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
  const [swipeStartX, setSwipeStartX] = useState<number | null>(null);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  
  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<{ [key: string]: Video | null }>({});
  const pauseTimeoutRefs = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const swipeAnimation = useRef(new Animated.Value(0)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;
  
  const { theme, mode } = useTheme();
  const router = useRouter();
  const { showSuccess, showError, showInfo, showWarning, showConfirm } = useAlert();
  const { handleScroll } = useScrollToHideNav();

  useEffect(() => {
    loadShorts();
    loadCurrentUser();
    loadSavedShorts();
    
    // Track screen view
    trackScreenView('shorts');
    
    // Hide swipe hint after 3 seconds
    const timer = setTimeout(() => {
      setShowSwipeHint(false);
    }, 3000);
    
    // Cleanup video refs on unmount
    return () => {
      clearTimeout(timer);
      // Cleanup all video refs
      Object.values(videoRefs.current).forEach(video => {
        if (video) {
          video.unloadAsync().catch(() => {
            // Silently fail cleanup
          });
        }
      });
      videoRefs.current = {};
      
      // Clear all pause timeouts
      Object.values(pauseTimeoutRefs.current).forEach(timeout => {
        clearTimeout(timeout);
      });
      pauseTimeoutRefs.current = {};
      
      // Clear video cache
      if (videoCacheRef.current) {
        videoCacheRef.current.clear();
      }
    };
  }, []);

  // Monitor network status for video quality adaptation
  useEffect(() => {
    const checkNetworkStatus = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        // Assume WiFi if request succeeds quickly
        setVideoQuality('high');
      } catch (error) {
        // Likely cellular or offline - use lower quality
        setVideoQuality('low');
      }
    };
    
    checkNetworkStatus();
    const interval = setInterval(checkNetworkStatus, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup videos that are far from viewport
  useEffect(() => {
    const cleanupDistance = 3; // Cleanup videos 3 positions away
    Object.keys(videoRefs.current).forEach((videoId) => {
      const videoIndex = shorts.findIndex(s => s._id === videoId);
      if (videoIndex === -1) return;
      
      const distance = Math.abs(videoIndex - currentIndex);
      if (distance > cleanupDistance) {
        const video = videoRefs.current[videoId];
        if (video) {
          video.unloadAsync().catch(() => {
            // Silently fail cleanup
          });
          delete videoRefs.current[videoId];
        }
      }
    });
  }, [currentIndex, shorts]);

  // Video cache for offline support
  const videoCacheRef = useRef<Map<string, { url: string; timestamp: number }>>(new Map());
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  // Get quality-adaptive video URL with caching
  const getVideoUrl = useCallback((item: PostType) => {
    const baseUrl = item.mediaUrl || item.imageUrl;
    const videoId = item._id;
    
    // Check cache first
    const cached = videoCacheRef.current.get(videoId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.url;
    }
    
    // Generate URL based on quality
    let url = baseUrl;
    if (videoQuality === 'low') {
      url = `${baseUrl}?q=low`;
    } else if (videoQuality === 'medium') {
      url = `${baseUrl}?q=medium`;
    }
    
    // Cache the URL
    videoCacheRef.current.set(videoId, {
      url,
      timestamp: Date.now()
    });
    
    return url;
  }, [videoQuality]);
  
  // Preload next video for smoother playback and track video views
  useEffect(() => {
    if (shorts[currentIndex]) {
      const currentShort = shorts[currentIndex];
      // Track video view
      trackPostView(currentShort._id, {
        type: 'short',
        source: 'shorts_feed'
      });
    }
    
    if (currentIndex < shorts.length - 1) {
      const nextShort = shorts[currentIndex + 1];
      if (nextShort) {
        const nextVideoUrl = getVideoUrl(nextShort);
        // Preload video in background
        setTimeout(() => {
          // Video preloading happens automatically when Video component mounts
          logger.debug('Preloading next video:', nextShort._id);
        }, 1000);
      }
    }
  }, [currentIndex, shorts, getVideoUrl]);

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
      logger.error('Error loading current user', error);
    }
  };

  const loadShorts = async () => {
    try {
      setLoading(true);
      const response = await getShorts(1, 20);
      setShorts(response.shorts);
      
      // Initialize follow states
      const followStatesMap: { [key: string]: boolean } = {};
      response.shorts.forEach((short: PostType) => {
        // Check if the user object has isFollowing property, otherwise default to false
        followStatesMap[short.user._id] = (short.user as any).isFollowing || false;
      });
      setFollowStates(followStatesMap);
    } catch (error) {
      logger.error('Error loading shorts', error);
      showError('Failed to load shorts');
    } finally {
      setLoading(false);
    }
  };

  const toggleVideoPlayback = (videoId: string) => {
    const video = videoRefs.current[videoId];
    if (video) {
      const isCurrentlyPlaying = videoStates[videoId];
      video.setStatusAsync({
        shouldPlay: !isCurrentlyPlaying,
      });
    }
  };

  const showPauseButtonTemporarily = (videoId: string) => {
    setShowPauseButton(prev => ({ ...prev, [videoId]: true }));
    
    // Clear existing timeout
    if (pauseTimeoutRefs.current[videoId]) {
      clearTimeout(pauseTimeoutRefs.current[videoId]);
    }
    
    // Set new timeout
    pauseTimeoutRefs.current[videoId] = setTimeout(() => {
      setShowPauseButton(prev => ({ ...prev, [videoId]: false }));
    }, 2000);
  };

  const handleLike = async (shortId: string) => {
    if (actionLoading === shortId) return;
    
    try {
      setActionLoading(shortId);
      const response = await toggleLike(shortId);
      
      setShorts(prev => prev.map(short => 
        short._id === shortId 
          ? { ...short, isLiked: response.isLiked, likesCount: response.likesCount }
          : short
      ));
      
      // Track engagement
      trackEngagement('like', 'short', shortId, {
        isLiked: response.isLiked
      });
      
      if (response.isLiked) {
        showSuccess('Added to favorites!');
      }
    } catch (error) {
      logger.error('Error toggling like', error);
      showError('Failed to update like status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleFollow = async (userId: string) => {
    if (actionLoading === userId) return;
    
    try {
      setActionLoading(userId);
      const response = await toggleFollow(userId);
      
      setFollowStates(prev => ({
        ...prev,
        [userId]: response.isFollowing
      }));
      
      if (response.isFollowing) {
        showSuccess('Following user!');
      } else {
        showInfo('Unfollowed user');
      }
    } catch (error) {
      logger.error('Error toggling follow', error);
      showError('Failed to update follow status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (shortId: string) => {
    try {
      const newSavedShorts = new Set(savedShorts);
      if (newSavedShorts.has(shortId)) {
        newSavedShorts.delete(shortId);
        await AsyncStorage.setItem('savedShorts', JSON.stringify([...newSavedShorts]));
        showInfo('Removed from saved');
      } else {
        newSavedShorts.add(shortId);
        await AsyncStorage.setItem('savedShorts', JSON.stringify([...newSavedShorts]));
        showSuccess('Saved to favorites!');
      }
      setSavedShorts(newSavedShorts);
    } catch (error) {
      logger.error('Error saving short', error);
      showError('Failed to save short');
    }
  };

  const handleShare = async (short: PostType) => {
    try {
      await Share.share({
        message: `Check out this amazing short by ${short.user.fullName}: ${short.caption}`,
        url: short.mediaUrl || short.imageUrl,
      });
      
      // Track share engagement
      trackEngagement('share', 'short', short._id);
    } catch (error) {
      logger.error('Error sharing', error);
      showError('Failed to share');
    }
  };

  const upsertSelectedComment = useCallback((incomingComment: any) => {
    if (!incomingComment) return;
    setSelectedShortComments((prev) => {
      const next = [...prev];
      if (incomingComment._id) {
        const existingIndex = next.findIndex((c) => c._id === incomingComment._id);
        if (existingIndex !== -1) {
          next[existingIndex] = incomingComment;
          return next;
        }
      }
      return [incomingComment, ...next];
    });
  }, []);

  const handleComment = async (shortId: string) => {
    setShowCommentModal(true);
    setSelectedShortId(shortId);
    
    // Load comments asynchronously to prevent UI blocking
    getPostById(shortId)
      .then(response => {
        setSelectedShortComments(response.post.comments || []);
      })
      .catch(error => {
        logger.error('Error loading comments', error);
        showError('Failed to load comments');
        setShowCommentModal(false);
        setSelectedShortId(null);
      });
  };

  const handleCommentAdded = (comment: any) => {
    upsertSelectedComment(comment);
    setShorts(prev => prev.map(short => 
      short._id === selectedShortId 
        ? { ...short, commentsCount: short.commentsCount + 1 }
        : short
    ));
  };

  const handleProfilePress = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  const handleSwipeLeft = (userId: string) => {
    // Animate swipe gesture
    Animated.sequence([
      Animated.timing(swipeAnimation, {
        toValue: -1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Navigate to profile
      router.push(`/profile/${userId}`);
      
      // Reset animations
      swipeAnimation.setValue(0);
      fadeAnimation.setValue(1);
    });
  };

  const handleDeleteShort = async (shortId: string) => {
    showConfirm(
      'Are you sure you want to delete this short?',
      async () => {
        try {
          await deleteShort(shortId);
          
          // Remove from local state
          setShorts(prev => prev.filter(short => short._id !== shortId));
          
          // Remove from saved shorts if it exists there
          const savedShorts = await AsyncStorage.getItem('savedShorts');
          if (savedShorts) {
            const savedIds = JSON.parse(savedShorts);
            const updatedIds = savedIds.filter((id: string) => id !== shortId);
            await AsyncStorage.setItem('savedShorts', JSON.stringify(updatedIds));
          }
          
          showSuccess('Short deleted successfully!');
        } catch (error: any) {
          showError(error.message || 'Failed to delete short');
        }
      },
      'Delete',
      'Delete',
      'Cancel'
    );
  };

  const handleTouchStart = (event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    setSwipeStartX(pageX);
    setSwipeStartY(pageY);
  };

  const handleTouchMove = (event: any) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartX;
    const deltaY = pageY - swipeStartY;
    
    // Update animation based on horizontal movement
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      const progress = Math.min(Math.abs(deltaX) / 100, 1);
      swipeAnimation.setValue(-progress);
    }
  };

  const handleTouchEnd = (event: any, userId: string) => {
    if (swipeStartX === null || swipeStartY === null) return;
    
    const { pageX, pageY } = event.nativeEvent;
    const deltaX = pageX - swipeStartX;
    const deltaY = pageY - swipeStartY;
    
    // Only trigger swipe if horizontal movement is significantly greater
    const horizontalRatio = Math.abs(deltaX) / (Math.abs(deltaY) || 1);
    if (horizontalRatio > 1.5 && Math.abs(deltaX) > 50) {
      logger.debug('Swipe left detected, navigating to profile:', userId);
      handleSwipeLeft(userId);
    } else {
      // Reset animation if not a valid swipe
      Animated.spring(swipeAnimation, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();
    }
    
    setSwipeStartX(null);
    setSwipeStartY(null);
  };

  const renderShortItem = useCallback(({ item, index }: { item: PostType; index: number }) => {
    // Get actual video playing state - if videoStates has a value, use it; otherwise default to true only if current index
    const videoState = videoStates[item._id];
    const isVideoPlaying = videoState !== undefined ? videoState : (index === currentIndex);
    const isFollowing = followStates[item.user._id] || false;
    const isSaved = savedShorts.has(item._id);
    const isLiked = item.isLiked || false;
    
    // Debug: Log song data
    if (item.song) {
      logger.debug('Short has song data:', {
        hasSong: !!item.song,
        hasSongId: !!item.song.songId,
        songId: item.song.songId,
        s3Url: item.song.songId?.s3Url,
        title: item.song.songId?.title,
        artist: item.song.songId?.artist,
      });
    }

    return (
      <View style={styles.shortItem}>
          {/* Video Player with Gesture Handling */}
          <View
            style={styles.videoContainer}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={(event) => handleTouchEnd(event, item.user._id)}
          >
            <TouchableWithoutFeedback 
              onPress={() => {
                toggleVideoPlayback(item._id);
                showPauseButtonTemporarily(item._id);
              }}
              onLongPress={() => {
                // Only allow delete for own content
                if (item.user._id === currentUser?._id) {
                  handleDeleteShort(item._id);
                }
              }}
            >
              <Video
              ref={(ref) => {
                videoRefs.current[item._id] = ref;
              }}
              source={{ uri: getVideoUrl(item) }}
              style={styles.shortVideo}
              resizeMode={ResizeMode.COVER}
              shouldPlay={isVideoPlaying}
              isLooping
              isMuted={index !== currentIndex}
              onPlaybackStatusUpdate={(status: AVPlaybackStatus) => {
                if (status.isLoaded) {
                  const wasPlaying = videoStates[item._id];
                  const isNowPlaying = status.isPlaying;
                  
                  // Always update video state to reflect actual playback status
                  setVideoStates(prev => {
                    const newState = {
                      ...prev,
                      [item._id]: isNowPlaying
                    };
                    
                    // Log state change for debugging
                    if (wasPlaying !== isNowPlaying) {
                      logger.debug(`Video ${item._id} ${isNowPlaying ? 'playing' : 'paused'}`);
                    }
                    
                    return newState;
                  });
                }
              }}
              onLoad={(status) => {
                // Initialize video state when video loads
                if (status.isLoaded) {
                  setVideoStates(prev => ({
                    ...prev,
                    [item._id]: status.isPlaying || false
                  }));
                }
              }}
            />
            </TouchableWithoutFeedback>
          </View>
          
          {/* Elegant Gradient Overlays */}
          <LinearGradient
            colors={['transparent', 'transparent']}
            style={styles.topGradient}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.bottomGradient}
          />
          
          {/* Play/Pause Overlay */}
          {(showPauseButton[item._id] || !videoStates[item._id]) && (
            <View style={styles.playButton}>
              <View style={styles.playButtonBlur}>
                <Ionicons 
                  name={videoStates[item._id] ? "pause" : "play"} 
                  size={50} 
                  color="white" 
                />
              </View>
            </View>
          )}

          {/* Swipe Hint */}
          {showSwipeHint && index === currentIndex && (
            <Animated.View style={[styles.swipeHint, { opacity: fadeAnimation }]}>
              <View style={styles.swipeHintBlur}>
                <Ionicons name="arrow-back" size={24} color="white" />
                <Text style={styles.swipeHintText}>Swipe left for profile</Text>
              </View>
            </Animated.View>
          )}
        
          {/* Right Side Action Buttons */}
          <View style={styles.rightActions}>
            {/* Profile Picture */}
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => handleProfilePress(item.user._id)}
            >
              <Image
                source={{ uri: item.user.profilePic }}
                style={styles.profileImage}
              />
              {/* Follow Button - Only show if not own user */}
              {item.user._id !== currentUser?._id && (
                <View style={[styles.followButton, isFollowing && styles.followingButton]}>
                  <Ionicons 
                    name={isFollowing ? "checkmark" : "add"} 
                    size={12} 
                    color="white" 
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Like Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item._id)}
              disabled={actionLoading === item._id}
            >
              <View style={[styles.actionIconContainer, isLiked && styles.likedContainer]}>
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={28} 
                  color={isLiked ? "#FF3040" : "white"} 
                />
              </View>
              <Text style={styles.actionText}>{item.likesCount || 0}</Text>
            </TouchableOpacity>

            {/* Comment Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleComment(item._id)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="chatbubble-outline" size={28} color="white" />
              </View>
              <Text style={styles.actionText}>{item.commentsCount || 0}</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleShare(item)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="paper-plane-outline" size={28} color="white" />
              </View>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleSave(item._id)}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons 
                  name={isSaved ? "bookmark" : "bookmark-outline"} 
                  size={28} 
                  color={isSaved ? "#FFD700" : "white"} 
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom Content with Elegant Design */}
          <View style={styles.bottomContent}>
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              style={styles.bottomGradientOverlay}
            />
            
            <View style={styles.bottomContentInner}>
              <TouchableOpacity 
                style={styles.userProfileSection}
                onPress={() => handleProfilePress(item.user._id)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarContainer}>
                  <Image
                    source={{ uri: item.user.profilePic }}
                    style={styles.userAvatar}
                  />
                  <View style={styles.avatarRing} />
                </View>
                <View style={styles.userDetails}>
                  <View style={styles.usernameRow}>
                    <Text style={styles.username}>@{item.user.fullName}</Text>
                    {isFollowing && (
                      <View style={styles.followingBadge}>
                        <Text style={styles.followingText}>Following</Text>
                      </View>
                    )}
                  </View>
                  
                  {item.caption && (
                    <Text style={styles.caption} numberOfLines={2}>
                      {item.caption}
                    </Text>
                  )}
                  
                  {item.tags && item.tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {item.tags.slice(0, 3).map((tag, tagIndex) => (
                        <View key={tagIndex} style={styles.tagBadge}>
                          <Text style={styles.tag}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              
              {/* Song Player - Elegant Design - Synced with Video */}
              {item.song?.songId && item.song.songId.s3Url ? (
                <View style={styles.songPlayerWrapper} pointerEvents="box-none">
                  <SongPlayer 
                    post={item} 
                    isVisible={index === currentIndex} 
                    autoPlay={isVideoPlaying} 
                  />
                </View>
              ) : null}
            </View>
          </View>
      </View>
    );
  }, [currentIndex, videoStates, followStates, savedShorts, actionLoading, currentUser, showPauseButton, swipeAnimation, fadeAnimation, handleTouchStart, handleTouchMove, handleTouchEnd, toggleVideoPlayback, showPauseButtonTemporarily, handleDeleteShort, handleProfilePress, handleLike, handleComment, handleShare, handleSave, getVideoUrl]);

  // Memoize keyExtractor and getItemLayout at top level (before conditional returns)
  const keyExtractor = useCallback((item: PostType) => item._id, []);
  
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  }), []);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#FF3040" style={styles.loadingSpinner} />
            <Text style={styles.loadingTitle}>Loading Shorts</Text>
            <Text style={styles.loadingSubtitle}>Discover amazing content</Text>
          </View>
        </View>
      </View>
    );
  }

  if (shorts.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-outline" size={80} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyTitle}>No Shorts Available</Text>
          <Text style={styles.emptyDescription}>
            Be the first to create amazing short videos and share your stories with the world.
          </Text>
          <TouchableOpacity 
            style={styles.createShortButton}
            onPress={() => router.push('/(tabs)/post')}
          >
            <LinearGradient
              colors={['#FF3040', '#FF6B6B']}
              style={styles.createShortGradient}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createShortButtonText}>Create Short</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="transparent" 
        translucent={true}
      />

      <FlatList
        ref={flatListRef}
        data={shorts}
        renderItem={renderShortItem}
        keyExtractor={keyExtractor}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        removeClippedSubviews={true}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        directionalLockEnabled={false}
        alwaysBounceVertical={true}
        bounces={true}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(event.nativeEvent.contentOffset.y / SCREEN_HEIGHT);
          setCurrentIndex(index);
        }}
        getItemLayout={getItemLayout}
      />

      {/* Comment Modal */}
      {selectedShortId && (
        <PostComments
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
    paddingTop: 0,
    marginTop: 0,
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
  loadingSpinner: {
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: 'white',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  createShortButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  createShortGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  createShortButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  shortItem: {
    width: '100%',
    height: SCREEN_HEIGHT,
    position: 'relative',
    backgroundColor: 'black',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: 'black',
  },
  shortVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: 'black',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    zIndex: 1,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    zIndex: 1,
  },
  playButton: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -35 }, { translateY: -35 }],
    zIndex: 10,
  },
  playButtonBlur: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  swipeHint: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 15,
  },
  swipeHintBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  swipeHintText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    zIndex: 5,
  },
  profileButton: {
    marginBottom: 20,
    position: 'relative',
  },
  profileImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'white',
  },
  followButton: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3040',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  followingButton: {
    backgroundColor: '#2196F3',
    borderColor: 'white',
    borderWidth: 2,
  },
  actionButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  actionIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  likedContainer: {
    backgroundColor: 'rgba(255, 48, 64, 0.2)',
  },
  actionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 80,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingTop: 20,
    paddingHorizontal: 20,
    zIndex: 5,
  },
  bottomGradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  bottomContentInner: {
    position: 'relative',
    zIndex: 1,
  },
  userProfileSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  avatarRing: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  userDetails: {
    flex: 1,
    paddingTop: 2,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginRight: 8,
  },
  followingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followingText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  caption: {
    color: 'rgba(255,255,255,0.98)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 6,
  },
  tagBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  tag: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  songPlayerWrapper: {
    marginTop: 14,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'flex-start',
    zIndex: 100,
  },
});