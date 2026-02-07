import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  PanResponder,
  Dimensions,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Image
} from 'react-native';
import { getSongs, Song } from '../services/songs';
import { useTheme } from '../context/ThemeContext';
import logger from '../utils/logger';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Use existing haptic utility to avoid circular dependencies
import { triggerHaptic } from '../utils/hapticFeedback';

// Safe haptic functions using existing utility
const hapticLight = () => {
  try {
    triggerHaptic('light');
  } catch (e) {
    // Silently fail - haptics not available
  }
};

const hapticMedium = () => {
  try {
    triggerHaptic('medium');
  } catch (e) {
    // Silently fail - haptics not available
  }
};

const hapticSuccess = () => {
  try {
    triggerHaptic('success');
  } catch (e) {
    // Silently fail - haptics not available
  }
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_SELECTION_DURATION = 60; // 60 seconds max

interface SongSelectorProps {
  onSelect: (song: Song | null, startTime?: number, endTime?: number) => void;
  selectedSong: Song | null;
  selectedStartTime?: number;
  selectedEndTime?: number;
  videoDuration?: number | null; // Video duration in seconds - auto-match song selection
  visible: boolean;
  onClose: () => void;
}

export const SongSelector: React.FC<SongSelectorProps> = ({
  onSelect,
  selectedSong,
  selectedStartTime = 0,
  selectedEndTime = MAX_SELECTION_DURATION,
  videoDuration = null, // Video duration - auto-match song selection
  visible,
  onClose
}) => {
  const { theme } = useTheme();
  const [songs, setSongs] = useState<Song[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(selectedStartTime);
  const [endTime, setEndTime] = useState(selectedEndTime);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'both' | null>(null);
  const [limitState, setLimitState] = useState<'normal' | 'approachingMin' | 'atMinimum' | 'atMaximum'>('normal');
  const [dragTime, setDragTime] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const startHandleAnim = useRef(new Animated.Value(0)).current;
  const endHandleAnim = useRef(new Animated.Value(0)).current;
  const floatingBadgeAnim = useRef(new Animated.Value(0)).current;
  const floatingBadgeXAnim = useRef(new Animated.Value(0)).current;
  const timelineWidthRef = useRef<number>(SCREEN_WIDTH - 64);
  const timelineLayoutRef = useRef<{ x: number; width: number } | null>(null);
  const lastDragXRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelinePaddingRef = useRef<number>(28); // Padding from timelineWrapper
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible) {
      loadSongs();
      // Auto-match song selection duration with video duration if provided
      if (videoDuration && videoDuration > 0) {
        const matchedDuration = Math.min(videoDuration, MAX_SELECTION_DURATION);
        setStartTime(0);
        setEndTime(matchedDuration);
        logger.debug('SongSelector: Auto-matched duration with video:', {
          videoDuration,
          matchedDuration,
          startTime: 0,
          endTime: matchedDuration
        });
      } else if (selectedSong) {
        setCurrentSong(selectedSong);
        setStartTime(selectedStartTime);
        setEndTime(selectedEndTime);
      }
    } else {
      setSearchQuery('');
      setPage(1);
      setSongs([]);
      stopAudio();
      setCurrentSong(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setLimitState('normal');
      
      // Clear preview timeout
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    }
  }, [visible, videoDuration, selectedSong, selectedStartTime, selectedEndTime]);

  useEffect(() => {
    if (visible && selectedSong) {
      setCurrentSong(selectedSong);
      setStartTime(selectedStartTime);
      setEndTime(selectedEndTime);
    }
  }, [selectedSong, selectedStartTime, selectedEndTime, visible]);

  // Optimized audio status polling - reduce frequency to 200ms for better performance
  // Loop playback within selected range (startTime to endTime) to match video duration
  useEffect(() => {
    if (currentSong && isPlaying && soundRef.current) {
      const interval = setInterval(async () => {
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              const time = status.positionMillis / 1000;
              setCurrentTime(time);
              
              // Loop playback: when reaching endTime, restart from startTime
              // This ensures song plays only within video duration and loops seamlessly
              if (endTime && time >= endTime) {
                try {
                  // Seek back to startTime and continue playing (loop)
                  await soundRef.current.setPositionAsync(startTime * 1000);
                  setCurrentTime(startTime);
                  
                  // Ensure playback continues (in case it was paused)
                  if (!status.isPlaying) {
                    await soundRef.current.playAsync();
                  }
                  
                  logger.debug('Song playback looped back to start:', {
                    startTime,
                    endTime,
                    videoDuration,
                    selectionDuration: endTime - startTime
                  });
                } catch (loopError) {
                  logger.warn('Error looping playback:', loopError);
                  // Fallback: pause if loop fails
                  await soundRef.current.pauseAsync();
                  setIsPlaying(false);
                  setCurrentTime(startTime);
                }
              }
            }
          } catch (error) {
            logger.error('Error getting audio status:', error);
          }
        }
      }, 200); // Reduced from 100ms to 200ms for better performance

      return () => clearInterval(interval);
    }
  }, [currentSong, isPlaying, startTime, endTime, videoDuration]);

  useEffect(() => {
    if (currentSong && timelineLayoutRef.current) {
      const duration = currentSong.duration || 0;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      
      // Convert time to pixel position using translateX
      // translateX = (time / duration) * timelineWidth
      const { width } = timelineLayoutRef.current;
      const startX = duration > 0 ? (startTime / duration) * width : 0;
      const endX = duration > 0 ? (endTime / duration) * width : width;
      
      progressAnim.setValue(progress);
      // Update handle positions directly in pixels (translateX)
      // Clamp to valid range to prevent handles from going out of bounds
      startHandleAnim.setValue(Math.max(0, Math.min(startX, width)));
      endHandleAnim.setValue(Math.max(0, Math.min(endX, width)));
    }
  }, [currentTime, startTime, endTime, currentSong]);

  const loadSongs = useCallback(async (pageNum: number = 1) => {
    if (loading) return;

    setLoading(true);
    try {
      const result = await getSongs(searchQuery || undefined, undefined, pageNum, 50);
      if (pageNum === 1) {
        setSongs(result.songs);
      } else {
        setSongs(prev => [...prev, ...result.songs]);
      }
      setHasMore(result.pagination.currentPage < result.pagination.totalPages);
      setPage(pageNum);
    } catch (error) {
      logger.error('Error loading songs:', error);
      Alert.alert('Error', 'Failed to load songs. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading, searchQuery]);

  // Debounced search to prevent excessive API calls
  useEffect(() => {
    if (!visible) return;
    
    // Clear previous debounce
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Reset state for new search
    setPage(1);
    setSongs([]);
    
    // Debounce search by 300ms
    searchDebounceRef.current = setTimeout(() => {
      loadSongs(1);
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, visible]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      loadSongs(page + 1);
    }
  }, [loading, hasMore, page, loadSongs]);

  // Get the effective max duration based on video duration or default
  const getMaxSelectionDuration = useCallback(() => {
    if (videoDuration && videoDuration > 0) {
      return Math.min(videoDuration, MAX_SELECTION_DURATION);
    }
    return MAX_SELECTION_DURATION;
  }, [videoDuration]);

  const loadAudio = async (song: Song) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.s3Url },
        { 
          shouldPlay: false,
          progressUpdateIntervalMillis: 200, // Update every 200ms for smooth looping
          isLooping: false // We handle looping manually to respect startTime/endTime
        }
      );
      
      soundRef.current = sound;
      setCurrentSong(song);
      
      // Use video duration if provided, otherwise use song duration or max
      const maxDuration = getMaxSelectionDuration();
      const songDuration = song.duration || MAX_SELECTION_DURATION;
      const finalDuration = Math.min(maxDuration, songDuration);
      
      // Set initial times - start at 0, end at video duration (or max)
      setStartTime(0);
      setEndTime(finalDuration);
      setCurrentTime(0); // Start at beginning
      
      logger.debug('Audio loaded with duration:', {
        videoDuration,
        maxDuration,
        songDuration,
        finalDuration,
        startTime: 0,
        endTime: finalDuration,
        willLoop: true
      });
    } catch (error) {
      logger.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio preview');
    }
  };

  const playAudio = async () => {
    if (!soundRef.current || !currentSong) return;

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        // Always start playback from startTime to ensure it loops within selected range
        await soundRef.current.setPositionAsync(startTime * 1000);
        setCurrentTime(startTime);
        await soundRef.current.playAsync();
        setIsPlaying(true);
        
        logger.debug('Playback started:', {
          startTime,
          endTime,
          selectionDuration: endTime - startTime,
          videoDuration,
          willLoop: true
        });
      }
    } catch (error) {
      logger.error('Error playing audio:', error);
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        // Check if sound is still valid before attempting to stop/unload
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          // Only stop if sound is currently playing
          if (status.isPlaying) {
            await soundRef.current.stopAsync();
          }
          // Unload the sound to release resources
          if (typeof soundRef.current.unloadAsync === 'function') {
            await soundRef.current.unloadAsync();
          }
        }
        soundRef.current = null;
      } catch (error) {
        // Silently handle errors - sound may already be unloaded or in invalid state
        if (__DEV__) {
          logger.debug('Error stopping audio (expected if already unloaded):', error);
        }
        // Clear the ref even if there was an error
        soundRef.current = null;
      }
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSelect = useCallback(async (song: Song) => {
    await loadAudio(song);
  }, [getMaxSelectionDuration]); // Include getMaxSelectionDuration to ensure it's available when loadAudio is called

  const handleConfirm = () => {
    const maxDuration = getMaxSelectionDuration();
    
    if (currentSong) {
      const maxEndTime = Math.min(endTime, currentSong.duration || maxDuration);
      const finalEndTime = Math.min(maxEndTime, startTime + maxDuration);
      
      if (finalEndTime <= startTime) {
        Alert.alert('Invalid Selection', 'Please select at least 0.5 seconds of the song.');
        return;
      }
      
      onSelect(currentSong, startTime, finalEndTime);
    } else if (selectedSong) {
      const finalEndTime = Math.min(endTime, startTime + maxDuration);
      onSelect(selectedSong, startTime, finalEndTime);
    } else {
      Alert.alert('No Song Selected', 'Please select a song first.');
      return;
    }
    onClose();
  };

  const handleRemove = () => {
    stopAudio();
    setCurrentSong(null);
    setStartTime(0);
    const maxDuration = getMaxSelectionDuration();
    setEndTime(maxDuration);
    onSelect(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = useCallback((x: number, duration: number) => {
    // Account for padding (handles extend 28px on each side)
    const adjustedX = x - timelinePaddingRef.current;
    const width = timelineWidthRef.current;
    const progress = Math.max(0, Math.min(100, (adjustedX / width) * 100));
    return (progress / 100) * duration;
  }, []);

  const snapToPrecision = (time: number): number => {
    return Math.round(time * 10) / 10;
  };

  const MIN_DRAG_DELTA = 1; // Reduced from 2 for better sensitivity
  const MIN_DURATION = 0.5;
  const MAX_DURATION = 60;
  const WARNING_THRESHOLD = 0.1; // 0.1s before limit

  // Check limits and provide feedback
  const checkLimitsAndProvideFeedback = useCallback((newStart: number, newEnd: number) => {
    const duration = newEnd - newStart;
    
    // Approaching minimum
    if (duration <= MIN_DURATION + WARNING_THRESHOLD && duration > MIN_DURATION) {
      hapticLight(); // Subtle warning
      return { type: 'approachingMin' as const, canMove: true };
    }
    
    // At minimum (can't shrink)
    if (duration <= MIN_DURATION) {
      hapticMedium(); // Stronger feedback
      return { type: 'atMinimum' as const, canMove: false };
    }
    
    // At maximum (can't expand)
    if (duration >= MAX_DURATION) {
      hapticLight(); // Subtle warning
      return { type: 'atMaximum' as const, canMove: false };
    }
    
    return { type: 'normal' as const, canMove: true };
  }, []);

  // Quick adjust functions for better UX with haptic feedback
  const adjustStartTime = useCallback((delta: number) => {
    if (!currentSong) return;
    hapticLight();
    const maxDuration = getMaxSelectionDuration();
    const duration = currentSong.duration || 0;
    const newStart = Math.max(0, Math.min(startTime + delta, endTime - 0.5)); // Minimum 0.5s gap
    const maxEnd = Math.min(duration, newStart + maxDuration);
    setStartTime(newStart);
    if (endTime > maxEnd) {
      setEndTime(maxEnd);
    }
    // Seek to new start time if playing
    if (soundRef.current && isPlaying) {
      soundRef.current.setPositionAsync(newStart * 1000).catch(() => {});
      setCurrentTime(newStart);
    }
  }, [currentSong, startTime, endTime, isPlaying, getMaxSelectionDuration]);

  const adjustEndTime = useCallback((delta: number) => {
    if (!currentSong) return;
    hapticLight();
    const maxDuration = getMaxSelectionDuration();
    const duration = currentSong.duration || 0;
    const maxEnd = Math.min(duration, startTime + maxDuration);
    const newEnd = Math.min(maxEnd, Math.max(endTime + delta, startTime + 0.5)); // Minimum 0.5s gap
    setEndTime(newEnd);
  }, [currentSong, startTime, endTime, getMaxSelectionDuration]);
  
  // Tap-to-seek: Tap on timeline to jump to that position
  const handleTimelineTap = useCallback((pageX: number) => {
    if (!currentSong || isDragging || !timelineLayoutRef.current) return;
    
    // Extract position immediately to avoid synthetic event reuse
    // Use pageX + measured layout for accurate positioning
    const { x: timelineX, width } = timelineLayoutRef.current;
    const relativeX = pageX - timelineX - timelinePaddingRef.current;
    const normalizedX = Math.max(0, Math.min(1, relativeX / width));
    
    const duration = currentSong.duration || 0;
    const tappedTime = normalizedX * duration;
    const snappedTime = snapToPrecision(tappedTime);
    
    // Haptic feedback
    hapticMedium();
    
    // Seek audio to tapped position
    if (soundRef.current) {
      soundRef.current.setPositionAsync(snappedTime * 1000).catch(() => {});
    }
    setCurrentTime(snappedTime);
  }, [currentSong, isDragging]);
  
  // Double-tap to set start/end point
  const handleTimelineDoubleTap = useCallback((pageX: number, pointType: 'start' | 'end') => {
    if (!currentSong || isDragging || !timelineLayoutRef.current) return;
    
    // Extract position immediately to avoid synthetic event reuse
    // Use pageX + measured layout for accurate positioning
    const { x: timelineX, width } = timelineLayoutRef.current;
    const relativeX = pageX - timelineX - timelinePaddingRef.current;
    const normalizedX = Math.max(0, Math.min(1, relativeX / width));
    
    const duration = currentSong.duration || 0;
    const tappedTime = normalizedX * duration;
    const snappedTime = snapToPrecision(tappedTime);
    
    // Haptic feedback
    hapticSuccess();
    
    const maxDuration = getMaxSelectionDuration();
    
    if (pointType === 'start') {
      const newStart = Math.max(0, Math.min(snappedTime, endTime - 0.5)); // Minimum 0.5s gap
      const maxEnd = Math.min(duration, newStart + maxDuration);
      setStartTime(newStart);
      if (endTime > maxEnd) {
        setEndTime(maxEnd);
      }
      // Seek audio to new start
      if (soundRef.current) {
        soundRef.current.setPositionAsync(newStart * 1000).catch(() => {});
        setCurrentTime(newStart);
      }
    } else {
      const maxEnd = Math.min(duration, startTime + maxDuration);
      const newEnd = Math.min(maxEnd, Math.max(snappedTime, startTime + 0.5)); // Minimum 0.5s gap
      setEndTime(newEnd);
      // Seek audio to new end
      if (soundRef.current) {
        soundRef.current.setPositionAsync(newEnd * 1000).catch(() => {});
        setCurrentTime(newEnd);
      }
    }
  }, [currentSong, isDragging, startTime, endTime, getMaxSelectionDuration]);

  const startHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Extract values immediately to avoid synthetic event reuse
      const { pageX, locationX } = evt.nativeEvent;
      const initialX = timelineLayoutRef.current 
        ? pageX - timelineLayoutRef.current.x - timelinePaddingRef.current
        : locationX;
      
      hapticMedium();
      setIsDragging(true);
      setDragType('start');
      lastDragXRef.current = initialX;
      
      // Animate floating badge in
      Animated.timing(floatingBadgeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      
      // Update floating badge position
      if (timelineLayoutRef.current && currentSong) {
        const { width } = timelineLayoutRef.current;
        const badgePercent = startTime / (currentSong.duration || 1) * 100;
        const badgeX = (badgePercent / 100) * width - 28;
        floatingBadgeXAnim.setValue(badgeX);
      }
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging || !timelineLayoutRef.current) return;
      
      // Extract values immediately to avoid synthetic event reuse
      const { pageX, locationX } = evt.nativeEvent;
      const currentX = timelineLayoutRef.current
        ? pageX - timelineLayoutRef.current.x - timelinePaddingRef.current
        : locationX;
      
      const lastX = lastDragXRef.current;
      
      if (lastX === null) {
        lastDragXRef.current = currentX;
        return;
      }
      
      const deltaX = currentX - lastX;
      if (Math.abs(deltaX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      // Convert current position to time
      const duration = currentSong.duration || 0;
      const { width } = timelineLayoutRef.current;
      const relativeX = Math.max(0, Math.min(currentX, width));
      const time = (relativeX / width) * duration;
      const snappedTime = snapToPrecision(time);
      
      // Clamp start handle: cannot go past endTime - minDuration
      const MIN_DURATION = 0.5;
      const maxStart = endTime - MIN_DURATION;
      const newStart = Math.max(0, Math.min(snappedTime, maxStart));
      
      // Check limits
      const limitCheck = checkLimitsAndProvideFeedback(newStart, endTime);
      setLimitState(limitCheck.type);
      setDragTime(newStart);
      
      if (!limitCheck.canMove || newStart >= endTime) {
        hapticMedium();
        return;
      }
      
      // Update start time and handle position
      setStartTime(newStart);
      const startX = (newStart / duration) * width;
      startHandleAnim.setValue(startX);
    },
    onPanResponderRelease: async () => {
      hapticLight();
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
      setLimitState('normal');
      
      // Animate floating badge out
      Animated.timing(floatingBadgeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // ✅ Play 500ms preview at new position
      if (soundRef.current && currentSong) {
        try {
          // Clear any existing preview timeout
          if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
          }
          
          await soundRef.current.setPositionAsync(startTime * 1000);
          await soundRef.current.playAsync();
          
          // Stop after 500ms
          previewTimeoutRef.current = setTimeout(async () => {
            if (soundRef.current) {
              await soundRef.current.pauseAsync();
            }
          }, 500);
        } catch (error) {
          // Silent fail
        }
      }
    },
  });

  const endHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Extract values immediately to avoid synthetic event reuse
      const { pageX, locationX } = evt.nativeEvent;
      const initialX = timelineLayoutRef.current 
        ? pageX - timelineLayoutRef.current.x - timelinePaddingRef.current
        : locationX;
      
      hapticMedium();
      setIsDragging(true);
      setDragType('end');
      lastDragXRef.current = initialX;
      
      // Animate floating badge in
      Animated.timing(floatingBadgeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      
      // Update floating badge position
      if (timelineLayoutRef.current && currentSong) {
        const { width } = timelineLayoutRef.current;
        const badgePercent = endTime / (currentSong.duration || 1) * 100;
        const badgeX = (badgePercent / 100) * width - 28;
        floatingBadgeXAnim.setValue(badgeX);
      }
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging || !timelineLayoutRef.current) return;
      
      // Calculate drag delta from initial touch position
      const currentX = evt.nativeEvent.locationX;
      const lastX = lastDragXRef.current;
      
      if (lastX === null) {
        lastDragXRef.current = currentX;
        return;
      }
      
      const deltaX = currentX - lastX;
      if (Math.abs(deltaX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      // Convert current position to time
      const duration = currentSong.duration || 0;
      const { width } = timelineLayoutRef.current;
      const relativeX = Math.max(0, Math.min(currentX, width));
      const time = (relativeX / width) * duration;
      const snappedTime = snapToPrecision(time);
      
      // Clamp end handle: cannot go before startTime + minDuration
      const MIN_DURATION = 0.5;
      const minEnd = startTime + MIN_DURATION;
      const maxDuration = videoDuration && videoDuration > 0 ? Math.min(videoDuration, MAX_SELECTION_DURATION) : MAX_SELECTION_DURATION;
      const maxEnd = Math.min(duration, startTime + maxDuration);
      const newEnd = Math.max(minEnd, Math.min(snappedTime, maxEnd));
      
      // Check limits
      const limitCheck = checkLimitsAndProvideFeedback(startTime, newEnd);
      setLimitState(limitCheck.type);
      setDragTime(newEnd);
      
      if (!limitCheck.canMove || newEnd <= startTime) {
        hapticMedium();
        return;
      }
      
      // Update end time and handle position
      setEndTime(newEnd);
      const endX = (newEnd / duration) * width;
      endHandleAnim.setValue(endX);
    },
    onPanResponderRelease: async () => {
      hapticLight();
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
      setLimitState('normal');
      
      // Animate floating badge out
      Animated.timing(floatingBadgeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      
      // ✅ Play 500ms preview at new position
      if (soundRef.current && currentSong) {
        try {
          if (previewTimeoutRef.current) {
            clearTimeout(previewTimeoutRef.current);
          }
          
          await soundRef.current.setPositionAsync(endTime * 1000);
          await soundRef.current.playAsync();
          
          previewTimeoutRef.current = setTimeout(async () => {
            if (soundRef.current) {
              await soundRef.current.pauseAsync();
            }
          }, 500);
        } catch (error) {
          // Silent fail
        }
      }
    },
  });

  const selectionPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      // Extract values immediately to avoid synthetic event reuse
      const { pageX, locationX } = evt.nativeEvent;
      const initialX = timelineLayoutRef.current 
        ? pageX - timelineLayoutRef.current.x - timelinePaddingRef.current
        : locationX;
      
      setIsDragging(true);
      setDragType('both');
      lastDragXRef.current = initialX;
      
      // Animate floating badge in
      Animated.timing(floatingBadgeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
      
      // Update floating badge position
      if (timelineLayoutRef.current && currentSong) {
        const { width } = timelineLayoutRef.current;
        const badgePercent = (endTime - startTime) / (currentSong.duration || 1) * 100;
        const badgeX = (badgePercent / 100) * width - 28;
        floatingBadgeXAnim.setValue(badgeX);
      }
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging || !timelineLayoutRef.current) return;
      
      // Extract values immediately to avoid synthetic event reuse
      const { pageX, locationX } = evt.nativeEvent;
      const currentX = timelineLayoutRef.current
        ? pageX - timelineLayoutRef.current.x - timelinePaddingRef.current
        : locationX;
      
      const lastX = lastDragXRef.current;
      
      if (lastX === null) {
        lastDragXRef.current = currentX;
        return;
      }
      
      if (Math.abs(currentX - lastX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      const duration = currentSong.duration || 0;
      const { width } = timelineLayoutRef.current;
      const relativeX = Math.max(0, Math.min(currentX, width));
      const time = (relativeX / width) * duration;
      const snappedTime = snapToPrecision(time);
      
      const maxDuration = videoDuration && videoDuration > 0 ? Math.min(videoDuration, MAX_SELECTION_DURATION) : MAX_SELECTION_DURATION;
      const selectionDuration = Math.min(endTime - startTime, maxDuration);
      const newStart = Math.max(0, Math.min(snappedTime, duration - selectionDuration));
      const newEnd = Math.min(duration, newStart + selectionDuration);
      
      // Check limits
      const limitCheck = checkLimitsAndProvideFeedback(newStart, newEnd);
      setLimitState(limitCheck.type);
      setDragTime(newEnd - newStart); // Show duration for 'both' drag
      
      if (!limitCheck.canMove) {
        hapticMedium();
        return;
      }
      
      setStartTime(newStart);
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
      setLimitState('normal');
      
      // Animate floating badge out
      Animated.timing(floatingBadgeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
  });

  const renderTimeline = () => {
    if (!currentSong) return null;

    const duration = currentSong.duration || 0;
    const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPercent = duration > 0 ? (endTime / duration) * 100 : 0;
    const selectionDuration = endTime - startTime;
    const maxDuration = getMaxSelectionDuration();
    const isMaxDuration = selectionDuration >= maxDuration;

    // Generate waveform bars with deterministic heights for consistent rendering
    // Note: Cannot use useMemo here as it's inside a render function (violates Rules of Hooks)
    // Using deterministic calculation instead of random for better performance
    const waveformBars = Array.from({ length: 50 }, (_, i) => {
      const barTime = (i / 50) * duration;
      const isInSelection = barTime >= startTime && barTime <= endTime;
      const isPlaying = barTime <= currentTime;
      // Use sine wave for consistent waveform pattern instead of random
      const height = 20 + Math.sin(i * 0.3) * 15 + Math.cos(i * 0.5) * 10;
      return { height, isInSelection, isPlaying };
    });

    return (
      <View key="timeline-container" style={[styles.timelineContainer, { backgroundColor: theme.colors.surface }]}>
        {/* Song Info Card */}
        <LinearGradient
          colors={[theme.colors.primary + '20', theme.colors.secondary + '20']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.songInfoCard}
        >
          <View style={styles.songInfoContent}>
            <View style={styles.songInfoText}>
              <Text style={[styles.songInfoTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {currentSong.title}
              </Text>
              <Text style={[styles.songInfoArtist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {currentSong.artist}
              </Text>
            </View>
            <View style={[styles.durationBadge, isMaxDuration && { backgroundColor: theme.colors.error + '30' }]}>
              <Ionicons 
                name="time-outline" 
                size={14} 
                color={isMaxDuration ? theme.colors.error : theme.colors.primary} 
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.durationBadgeText, { color: isMaxDuration ? theme.colors.error : theme.colors.primary }]}>
                {formatDuration(selectionDuration)} / {formatDuration(maxDuration)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Enhanced Timeline with Waveform */}
        <View style={[styles.timelineSection, { overflow: 'visible' }]}>
          <View 
            style={[styles.timelineWrapper, { overflow: 'visible' }]} 
            onLayout={(event) => {
              const { x, width } = event.nativeEvent.layout;
              timelineWidthRef.current = width - (timelinePaddingRef.current * 2); // Account for padding
              timelineLayoutRef.current = { x, width };
            }}
          >
            {/* Waveform Visualization */}
            <View style={styles.waveformContainer}>
              {waveformBars.map((bar, index) => {
                const isDark = theme.colors.background === '#000000' || theme.colors.background === '#111114';
                let backgroundColor: string;
                let opacity: number = 1;
                
                if (bar.isInSelection) {
                  // Selected: Full opacity, primary color
                  backgroundColor = theme.colors.primary;
                  opacity = 1.0;
                } else if (bar.isPlaying) {
                  // Playing but not selected: Primary color with reduced opacity
                  backgroundColor = theme.colors.primary;
                  opacity = 0.6;
                } else {
                  // Unselected: Border color with 30% opacity
                  backgroundColor = theme.colors.border;
                  opacity = isDark ? 0.3 : 0.25;
                }
                
                return (
                  <View
                    key={index}
                    style={[
                      styles.waveformBar,
                      {
                        height: bar.height,
                        backgroundColor,
                        opacity,
                      },
                    ]}
                  />
                );
              })}
            </View>

            {/* Timeline Track - Tap to Seek, Double-tap to Set Start/End */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={(evt) => {
                // Extract values immediately to avoid synthetic event reuse
                const { pageX } = evt.nativeEvent;
                
                const now = Date.now();
                const timeSinceLastTap = now - lastTapRef.current;
                
                if (timeSinceLastTap < 400 && lastTapRef.current > 0) {
                  // Double tap - determine which half to set start/end
                  if (timelineLayoutRef.current) {
                    const { x: timelineX, width } = timelineLayoutRef.current;
                    const relativeX = pageX - timelineX - timelinePaddingRef.current;
                    const midPoint = width / 2;
                    const pointType = relativeX < midPoint ? 'start' : 'end';
                    handleTimelineDoubleTap(pageX, pointType);
                  }
                  lastTapRef.current = 0; // Reset
                  if (tapTimeoutRef.current) {
                    clearTimeout(tapTimeoutRef.current);
                    tapTimeoutRef.current = null;
                  }
                } else {
                  // Single tap - seek to position (delayed to detect double tap)
                  lastTapRef.current = now;
                  if (tapTimeoutRef.current) {
                    clearTimeout(tapTimeoutRef.current);
                  }
                  tapTimeoutRef.current = setTimeout(() => {
                    handleTimelineTap(pageX);
                    lastTapRef.current = 0;
                  }, 400);
                }
              }}
              style={[styles.timelineTrack, { backgroundColor: theme.colors.border + '40', overflow: 'visible' }]}
            >
              {/* Selection Area - Draggable */}
              <View 
                style={[
                  styles.timelineSelection,
                  {
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                  },
                  limitState === 'atMinimum' && {
                    borderWidth: 2,
                    borderColor: theme.colors.error,
                    borderStyle: 'solid',
                  },
                  limitState === 'approachingMin' && {
                    borderWidth: 2,
                    borderColor: theme.colors.warning,
                    borderStyle: 'dashed',
                  },
                  limitState === 'atMaximum' && {
                    borderWidth: 2,
                    borderColor: theme.colors.warning,
                    borderStyle: 'dashed',
                  },
                ]}
                {...selectionPanResponder.panHandlers}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>

              {/* Progress Indicator */}
              <View
                style={[
                  styles.timelineProgress,
                  {
                    backgroundColor: 'transparent',
                    overflow: 'hidden',
                  }
                ]}
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '100%',
                    backgroundColor: theme.colors.primary + '30',
                    transform: [
                      {
                        scaleX: progressAnim.interpolate({
                          inputRange: [0, 100],
                          outputRange: [0, 1],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        translateX: 0,
                      },
                    ],
                  }}
                />
              </View>

              {/* Start Handle - Edge-style vertical bar */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -18,
                  width: 44, // Touch hit area (accessibility safe)
                  height: 60,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Animated.View
                  style={[
                    {
                      width: 4, // Slim vertical bar (edge-style)
                      height: 24,
                      borderRadius: 2,
                      backgroundColor: limitState === 'atMinimum' ? theme.colors.error : theme.colors.primary,
                      transform: [
                        {
                          // translateX positions handle at edge of selected region
                          // Using pixel values directly (not percentages) for native driver compatibility
                          translateX: startHandleAnim.interpolate({
                            inputRange: [0, timelineLayoutRef.current ? timelineLayoutRef.current.width : SCREEN_WIDTH - 64],
                            outputRange: [0, timelineLayoutRef.current ? timelineLayoutRef.current.width : SCREEN_WIDTH - 64],
                            extrapolate: 'clamp',
                          }),
                        },
                        {
                          scale: isDragging && dragType === 'start' ? 1.2 : 1,
                        },
                      ],
                    },
                    isDragging && dragType === 'start' && {
                      shadowColor: theme.colors.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1.0,
                      shadowRadius: 12,
                      elevation: 12,
                    },
                  ]}
                  {...startHandlePanResponder.panHandlers}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  {/* Small grab dot indicator at top */}
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.colors.primary,
                      position: 'absolute',
                      top: -3,
                      alignSelf: 'center',
                    }}
                  />
                </Animated.View>
              </View>

              {/* End Handle - Edge-style vertical bar */}
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  top: -18,
                  width: 44, // Touch hit area (accessibility safe)
                  height: 60,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Animated.View
                  style={[
                    {
                      width: 4, // Slim vertical bar (edge-style)
                      height: 24,
                      borderRadius: 2,
                      backgroundColor: limitState === 'atMinimum' ? theme.colors.error : theme.colors.primary,
                      transform: [
                        {
                          // translateX positions handle at edge of selected region
                          // Using pixel values directly (not percentages) for native driver compatibility
                          translateX: endHandleAnim.interpolate({
                            inputRange: [0, timelineLayoutRef.current ? timelineLayoutRef.current.width : SCREEN_WIDTH - 64],
                            outputRange: [0, timelineLayoutRef.current ? timelineLayoutRef.current.width : SCREEN_WIDTH - 64],
                            extrapolate: 'clamp',
                          }),
                        },
                        {
                          scale: isDragging && dragType === 'end' ? 1.2 : 1,
                        },
                      ],
                    },
                    isDragging && dragType === 'end' && {
                      shadowColor: theme.colors.primary,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1.0,
                      shadowRadius: 12,
                      elevation: 12,
                    },
                  ]}
                  {...endHandlePanResponder.panHandlers}
                  hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                  {/* Small grab dot indicator at top */}
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.colors.primary,
                      position: 'absolute',
                      top: -3,
                      alignSelf: 'center',
                    }}
                  />
                </Animated.View>
              </View>
            </TouchableOpacity>

            {/* Floating Timestamp Badge (only when dragging) */}
            {isDragging && dragType && timelineLayoutRef.current && (
              <View
                style={{
                  position: 'absolute',
                  left: timelinePaddingRef.current,
                  top: 0,
                }}
              >
                <Animated.View
                  style={[
                    styles.floatingBadge,
                    {
                      opacity: floatingBadgeAnim,
                      transform: [
                        { 
                          // Position badge above the dragged handle using translateX
                          // Subtract 28px to center badge (56px width / 2)
                          translateX: dragType === 'start' 
                            ? startHandleAnim.interpolate({
                                inputRange: [0, timelineLayoutRef.current.width],
                                outputRange: [-28, timelineLayoutRef.current.width - 28],
                                extrapolate: 'clamp',
                              })
                            : endHandleAnim.interpolate({
                                inputRange: [0, timelineLayoutRef.current.width],
                                outputRange: [-28, timelineLayoutRef.current.width - 28],
                                extrapolate: 'clamp',
                              })
                        },
                        { translateY: -44 }, // 12px above handle + 32px badge height
                      ],
                    },
                  ]}
                >
                  <Text style={styles.floatingBadgeText}>
                    {formatDuration(dragTime)}
                  </Text>
                </Animated.View>
              </View>
            )}

            {/* Time Labels - Instagram Style (Below handles) */}
            <View style={styles.timelineLabels}>
              <View style={styles.timeLabelContainer}>
                <View style={[styles.timeLabelBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Text style={[styles.timeLabel, { color: theme.colors.primary, fontWeight: '700' }]}>
                    {formatDuration(startTime)}
                  </Text>
                </View>
              </View>
              <View style={styles.timeLabelContainer}>
                <Text style={[styles.timeLabelDuration, { color: theme.colors.textSecondary }]}>
                  {formatDuration(endTime - startTime)}
                </Text>
              </View>
              <View style={styles.timeLabelContainer}>
                <View style={[styles.timeLabelBadge, { backgroundColor: theme.colors.primary + '20' }]}>
                  <Text style={[styles.timeLabel, { color: theme.colors.primary, fontWeight: '700' }]}>
                    {formatDuration(endTime)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Limit Warning Badge */}
            {limitState === 'atMinimum' && (
              <View style={[styles.limitWarningBadge, { backgroundColor: theme.colors.error }]}>
                <Ionicons name="alert-circle" size={12} color="#FFFFFF" />
                <Text style={styles.limitWarningText}>Minimum 0.5s</Text>
              </View>
            )}
          </View>

          {/* Simplified Help Text - Instagram Style */}
          <View style={styles.helpTextContainer}>
            <Text style={[styles.helpText, { color: theme.colors.textSecondary + '80' }]}>
              Drag the handles to select your favorite part
            </Text>
          </View>
        </View>

        {/* Enhanced Playback Controls */}
        <View style={styles.playbackControls}>
          <TouchableOpacity 
            onPress={playAudio} 
            style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.8}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={28} 
              color="#fff" 
            />
          </TouchableOpacity>
          <View style={styles.timeDisplayContainer}>
            <View style={styles.timeDisplayRow}>
              <Text style={[styles.timeDisplayLabel, { color: theme.colors.textSecondary }]}>Current</Text>
              <Text style={[styles.timeDisplay, { color: theme.colors.text }]}>
                {formatDuration(currentTime)}
              </Text>
            </View>
            <View style={styles.timeDisplayRow}>
              <Text style={[styles.timeDisplayLabel, { color: theme.colors.textSecondary }]}>Total</Text>
              <Text style={[styles.timeDisplay, { color: theme.colors.textSecondary }]}>
                {formatDuration(duration)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {/* Enhanced Header */}
        <LinearGradient
          colors={[theme.colors.surface, theme.colors.surfaceSecondary]}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="musical-notes" size={24} color={theme.colors.primary} />
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Select Music</Text>
          </View>
          <TouchableOpacity 
            onPress={handleConfirm} 
            style={[
              styles.doneButton,
              (!currentSong && !selectedSong) && styles.doneButtonDisabled
            ]}
            disabled={!currentSong && !selectedSong}
          >
            <Text style={[
              styles.doneButtonText, 
              { color: theme.colors.primary },
              (!currentSong && !selectedSong) && { color: theme.colors.textSecondary }
            ]}>
              Done
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* Enhanced Search */}
        <View style={[styles.searchContainer, { backgroundColor: theme.colors.surface }]}>
          <Ionicons name="search" size={20} color={theme.colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surfaceSecondary,
                color: theme.colors.text,
              }
            ]}
            placeholder="Search songs..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {(currentSong || selectedSong) && renderTimeline()}

        {loading && songs.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
              Loading songs...
            </Text>
          </View>
        ) : (
          <FlatList
            data={songs}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const isSelected = (currentSong?._id === item._id) || (selectedSong?._id === item._id);
              return (
                <TouchableOpacity
                  style={[
                    styles.songItem,
                    { borderBottomColor: theme.colors.border },
                    isSelected && { backgroundColor: theme.colors.primary + '15' }
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.7}
                >
                  {item.imageUrl || item.thumbnailUrl ? (
                    <Image
                      source={{ uri: item.imageUrl || item.thumbnailUrl }}
                      style={[styles.songImage, { borderColor: isSelected ? theme.colors.primary : theme.colors.border }]}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.songIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                      <Ionicons 
                        name={isSelected ? "musical-notes" : "musical-note-outline"} 
                        size={24} 
                        color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
                      />
                    </View>
                  )}
                  <View style={styles.songInfo}>
                    <Text style={[
                      styles.songTitle,
                      { color: theme.colors.text },
                      isSelected && { color: theme.colors.primary, fontWeight: '700' }
                    ]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[
                      styles.songArtist,
                      { color: theme.colors.textSecondary },
                    ]} numberOfLines={1}>
                      {item.artist} • {formatDuration(item.duration)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={64} color={theme.colors.textSecondary + '40'} />
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
                  No songs found
                </Text>
              </View>
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loading && songs.length > 0 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : null
            }
            // Performance optimizations
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={15}
            windowSize={10}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}

        {(currentSong || selectedSong) && (
          <View style={[styles.selectedContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <LinearGradient
              colors={[theme.colors.primary + '20', theme.colors.secondary + '20']}
              style={styles.selectedGradient}
            >
              <View style={styles.selectedInfo}>
                <View style={styles.selectedHeader}>
                  <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />
                  <Text style={[styles.selectedLabel, { color: theme.colors.textSecondary }]}>Selected</Text>
                </View>
                <Text style={[styles.selectedSongName, { color: theme.colors.text }]} numberOfLines={1}>
                  {(currentSong || selectedSong)?.title}
                </Text>
                <Text style={[styles.selectedArtist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                  {(currentSong || selectedSong)?.artist}
                </Text>
                <View style={styles.selectedTimeContainer}>
                  <Ionicons name="time" size={14} color={theme.colors.primary} />
                  <Text style={[styles.selectedTime, { color: theme.colors.primary }]}>
                    {formatDuration(startTime)} - {formatDuration(endTime)}
                  </Text>
                </View>
              </View>
              <TouchableOpacity 
                onPress={handleRemove} 
                style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
                <Text style={styles.removeButtonText}>Remove</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        )}
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  cancelButton: {
    padding: 8,
    borderRadius: 20,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  timelineContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  songInfoCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  songInfoContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songInfoText: {
    flex: 1,
    marginRight: 12,
  },
  songInfoTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  songInfoArtist: {
    fontSize: 14,
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
  durationBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  timelineSection: {
    marginBottom: 20,
    overflow: 'visible', // Allow handles to extend beyond container
  },
  timelineWrapper: {
    marginBottom: 16,
    overflow: 'visible', // Allow handles to extend beyond container
    paddingHorizontal: 28, // Add padding to ensure handles are visible at edges
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    marginBottom: 12,
    paddingHorizontal: 4,
    overflow: 'visible', // Allow handles to extend beyond waveform
  },
  waveformBar: {
    width: 3,
    borderRadius: 2,
    marginHorizontal: 1,
  },
  timelineTrack: {
    height: 12, // Increased height for easier dragging (Instagram style)
    borderRadius: 6,
    position: 'relative',
    marginBottom: 20,
    overflow: 'visible', // Ensure handles extending beyond track are visible
    width: '100%',
  },
  timelineSelection: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
    zIndex: 2,
  },
  timelineProgress: {
    position: 'absolute',
    height: '100%',
    borderRadius: 4,
    zIndex: 1,
  },
  timelineHandle: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    top: -28,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  handleDragging: {
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
  },
  startHandle: {
    // marginLeft handled inline to work with Animated
  },
  endHandle: {
    // marginLeft handled inline to work with Animated
  },
  handleOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    overflow: 'hidden',
  },
  handleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleInnerCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeLabelContainer: {
    alignItems: 'center',
    flex: 1,
  },
  timeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  timeLabelDuration: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  timeLabelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 50,
    alignItems: 'center',
  },
  playbackControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timeDisplayContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  timeDisplayRow: {
    alignItems: 'center',
  },
  timeDisplayLabel: {
    fontSize: 11,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeDisplay: {
    fontSize: 16,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  songIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
  },
  checkmark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  selectedContainer: {
    borderTopWidth: 1,
  },
  selectedGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  selectedInfo: {
    flex: 1,
    marginRight: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  selectedLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedSongName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedArtist: {
    fontSize: 14,
    marginBottom: 8,
  },
  selectedTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectedTime: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  helpTextContainer: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  helpText: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  floatingBadge: {
    position: 'absolute',
    width: 56,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  floatingBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  limitWarningBadge: {
    position: 'absolute',
    top: -40,
    left: '50%',
    transform: [{ translateX: -50 }],
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  limitWarningText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
