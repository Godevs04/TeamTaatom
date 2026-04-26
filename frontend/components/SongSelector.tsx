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
  ScrollView,
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
const MAX_SELECTION_DURATION = 30; // 30 seconds max (short max length)

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
  const [currentPage, setCurrentPage] = useState<'list' | 'trimmer'>('list');
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
  const waveformScrollRef = useRef<any>(null);
  const scrollOffsetRef = useRef<number>(0);
  const selectionDurationRef = useRef<number>(MAX_SELECTION_DURATION);
  const currentSongRef = useRef<Song | null>(null);
  const startTimeRef = useRef<number>(0);
  const endTimeRef = useRef<number>(MAX_SELECTION_DURATION);
  const trimGrantRef = useRef<{ startTime: number; endTime: number } | null>(null);
  const trimStartRef = useRef({ initialX: 0, initialStartTime: 0 });
  const trimEndRef = useRef({ initialX: 0, initialEndTime: 0 });
  const maxSelectionRef = useRef<number>(MAX_SELECTION_DURATION);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelinePaddingRef = useRef<number>(28); // Padding from timelineWrapper
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef<boolean>(false); // Sync ref to avoid stale closure in PanResponder

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
      }
      if (selectedSong) {
        setCurrentSong(selectedSong);
        setStartTime(selectedStartTime);
        setEndTime(selectedEndTime);
        setCurrentPage('trimmer'); // Go straight to trimmer if re-opening with a song
      } else {
        setCurrentPage('list');
      }
    } else {
      setSearchQuery('');
      setPage(1);
      setSongs([]);
      stopAudio();
      setCurrentSong(null);
      setCurrentPage('list');
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

  // Sync refs for scroll handler (avoid stale closures in callbacks)
  useEffect(() => {
    currentSongRef.current = currentSong;
  }, [currentSong]);

  useEffect(() => {
    startTimeRef.current = startTime;
    endTimeRef.current = endTime;
    selectionDurationRef.current = endTime - startTime;
  }, [startTime, endTime]);

  useEffect(() => {
    maxSelectionRef.current = videoDuration && videoDuration > 0
      ? Math.min(videoDuration, MAX_SELECTION_DURATION)
      : MAX_SELECTION_DURATION;
  }, [videoDuration]);

  // Scroll waveform to initial position when a new song is loaded
  useEffect(() => {
    if (currentSong && waveformScrollRef.current) {
      const dur = currentSong.duration || 0;
      const totalW = Math.max(SCREEN_WIDTH * 3, dur * 15);
      const pps = totalW / Math.max(dur, 1);
      const offset = startTimeRef.current * pps;
      setTimeout(() => {
        waveformScrollRef.current?.scrollTo({ x: offset, animated: false });
      }, 100);
    }
  }, [currentSong]);

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
      setCurrentTime(0);

      // Auto-play the selected segment immediately
      await sound.playAsync();
      setIsPlaying(true);

      logger.debug('Audio loaded and auto-playing:', {
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
    setCurrentPage('trimmer'); // Navigate to trimmer page after selecting
  }, [getMaxSelectionDuration]);

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

  // Left trim handle — drag to adjust selection start time
  const leftTrimPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      trimStartRef.current = {
        initialX: evt.nativeEvent.pageX,
        initialStartTime: startTimeRef.current,
      };
      hapticMedium();
    },
    onPanResponderMove: (evt) => {
      const song = currentSongRef.current;
      if (!song) return;

      const duration = song.duration || 0;
      const totalW = Math.max(SCREEN_WIDTH * 3, duration * 15);
      const pps = totalW / Math.max(duration, 1);

      const deltaX = evt.nativeEvent.pageX - trimStartRef.current.initialX;
      const deltaTime = deltaX / pps;
      const maxStart = endTimeRef.current - 0.5; // min 0.5s selection
      const newStart = snapToPrecision(
        Math.max(0, Math.min(trimStartRef.current.initialStartTime + deltaTime, maxStart))
      );

      setStartTime(newStart);
      startTimeRef.current = newStart;
      selectionDurationRef.current = endTimeRef.current - newStart;

      // Scroll to keep waveform aligned with new start position
      waveformScrollRef.current?.scrollTo({ x: newStart * pps, animated: false });
    },
    onPanResponderRelease: () => {
      hapticLight();
      if (soundRef.current) {
        soundRef.current.setPositionAsync(startTimeRef.current * 1000).catch(() => {});
        setCurrentTime(startTimeRef.current);
      }
    },
  }), []);

  // Right trim handle — drag to adjust selection end time
  const rightTrimPanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      trimEndRef.current = {
        initialX: evt.nativeEvent.pageX,
        initialEndTime: endTimeRef.current,
      };
      hapticMedium();
    },
    onPanResponderMove: (evt) => {
      const song = currentSongRef.current;
      if (!song) return;

      const duration = song.duration || 0;
      const totalW = Math.max(SCREEN_WIDTH * 3, duration * 15);
      const pps = totalW / Math.max(duration, 1);
      const maxDur = maxSelectionRef.current;

      const deltaX = evt.nativeEvent.pageX - trimEndRef.current.initialX;
      const deltaTime = deltaX / pps;
      const minEnd = startTimeRef.current + 0.5; // min 0.5s selection
      const maxEnd = Math.min(duration, startTimeRef.current + maxDur);
      const newEnd = snapToPrecision(
        Math.max(minEnd, Math.min(trimEndRef.current.initialEndTime + deltaTime, maxEnd))
      );

      setEndTime(newEnd);
      endTimeRef.current = newEnd;
      selectionDurationRef.current = newEnd - startTimeRef.current;
    },
    onPanResponderRelease: () => {
      hapticLight();
    },
  }), []);

  // Handle waveform horizontal scroll — updates start/end times as user drags
  const handleWaveformScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollOffsetRef.current = offsetX;

    const song = currentSongRef.current;
    if (!song) return;

    const duration = song.duration || 0;
    const selDur = selectionDurationRef.current;
    const totalW = Math.max(SCREEN_WIDTH * 3, duration * 15);
    const pps = totalW / Math.max(duration, 1);

    const newStart = snapToPrecision(Math.max(0, Math.min(offsetX / pps, duration - selDur)));
    const newEnd = snapToPrecision(Math.min(duration, newStart + selDur));

    setStartTime(newStart);
    setEndTime(newEnd);
  }, []);

  // Seek audio to new position when scroll ends
  const handleScrollEnd = useCallback(() => {
    if (soundRef.current && currentSongRef.current) {
      const st = startTimeRef.current;
      soundRef.current.setPositionAsync(st * 1000).catch(() => {});
      setCurrentTime(st);
    }
  }, []);

  const renderTimeline = () => {
    if (!currentSong) return null;

    const duration = currentSong.duration || 0;
    const selectionDuration = endTime - startTime;

    const isDark = theme.colors.background === '#000000' || theme.colors.background === '#111114';
    const bracketColor = theme.colors.primary;

    // Scrollable waveform: song's full proportional length, wider than screen
    const totalWaveformWidth = Math.max(SCREEN_WIDTH * 3, duration * 15);
    const PPS = totalWaveformWidth / Math.max(duration, 1);
    const selectionWidth = Math.min(SCREEN_WIDTH - 32, selectionDuration * PPS);
    const selectionLeft = (SCREEN_WIDTH - selectionWidth) / 2;
    const SIDE_PADDING = selectionLeft;

    // Generate bars proportional to song length (~3 bars per second, max 300)
    const NUM_BARS = Math.min(300, Math.max(80, Math.ceil(duration * 3)));
    const barTotalWidth = totalWaveformWidth / NUM_BARS;
    const barWidth = Math.max(2, barTotalWidth * 0.55);
    const barGap = (barTotalWidth - barWidth) / 2;

    // Smooth waveform pattern with multiple harmonics
    const bars = Array.from({ length: NUM_BARS }, (_, i) => {
      const base = 8;
      const wave = Math.sin(i * 0.18) * 16 + Math.cos(i * 0.32) * 12 + Math.sin(i * 0.55) * 8 + Math.cos(i * 0.12) * 6;
      return Math.max(4, base + wave);
    });

    return (
      <View key="timeline-container" style={{
        paddingTop: 16, paddingBottom: 14,
        borderTopWidth: 1, borderTopColor: theme.colors.border,
      }}>
        {/* Scrollable waveform with fixed selection bracket */}
        <View style={{ position: 'relative', height: 72, overflow: 'hidden' }}>
          {/* Horizontally scrollable waveform */}
          <ScrollView
            ref={waveformScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={handleWaveformScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            bounces={false}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollEndDrag={handleScrollEnd}
            contentContainerStyle={{
              paddingHorizontal: SIDE_PADDING,
              alignItems: 'center',
              height: 72,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', height: 64 }}>
              {bars.map((h, i) => (
                <View
                  key={i}
                  style={{
                    width: barWidth,
                    marginHorizontal: barGap,
                    height: h,
                    borderRadius: barWidth,
                    backgroundColor: theme.colors.primary,
                    opacity: 0.85,
                  }}
                />
              ))}
            </View>
          </ScrollView>

          {/* Fixed selection overlay */}
          <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
            {/* Left dimmed */}
            {selectionLeft > 0 && (
              <View pointerEvents="none" style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: selectionLeft,
                backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
              }} />
            )}
            {/* Right dimmed */}
            {selectionLeft > 0 && (
              <View pointerEvents="none" style={{
                position: 'absolute', right: 0, top: 0, bottom: 0,
                width: selectionLeft,
                backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
              }} />
            )}

            {/* Selection bracket — uses primary color */}
            <View pointerEvents="box-none" style={{
              position: 'absolute',
              left: selectionLeft, top: 0, bottom: 0,
              width: selectionWidth,
              borderWidth: 2.5,
              borderColor: bracketColor,
              borderRadius: 8,
            }}>
              {/* Left handle */}
              <View
                style={{
                  position: 'absolute', left: -1, top: 0, bottom: 0, width: 22,
                  backgroundColor: bracketColor,
                  borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
                  justifyContent: 'center', alignItems: 'center',
                  zIndex: 10,
                }}
                hitSlop={{ top: 14, bottom: 14, left: 18, right: 10 }}
                {...leftTrimPanResponder.panHandlers}
              >
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#fff' }} />
              </View>
              {/* Right handle */}
              <View
                style={{
                  position: 'absolute', right: -1, top: 0, bottom: 0, width: 22,
                  backgroundColor: bracketColor,
                  borderTopRightRadius: 8, borderBottomRightRadius: 8,
                  justifyContent: 'center', alignItems: 'center',
                  zIndex: 10,
                }}
                hitSlop={{ top: 14, bottom: 14, left: 10, right: 18 }}
                {...rightTrimPanResponder.panHandlers}
              >
                <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: '#fff' }} />
              </View>
            </View>
          </View>
        </View>

        {/* Time labels */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 10 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>
            {formatDuration(startTime)}
          </Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary + '80' }}>
            Scroll to select · Drag handles to trim
          </Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>
            {formatDuration(endTime)}
          </Text>
        </View>
      </View>
    );
  };

  // Go back to song list from trimmer
  const handleBackToList = () => {
    stopAudio();
    setCurrentSong(null);
    setCurrentPage('list');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (currentPage === 'trimmer') {
          handleBackToList();
        } else {
          onClose();
        }
      }}
    >
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>

        {/* ==================== PAGE 1: SONG LIST (Spotify-style) ==================== */}
        {currentPage === 'list' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          >
            {/* Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
            }}>
              <TouchableOpacity
                onPress={onClose}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="close" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text, letterSpacing: 0.3 }}>
                Add Music
              </Text>
              <View style={{ width: 36 }} />
            </View>

            {/* Search bar — Spotify pill style */}
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: theme.colors.surfaceSecondary,
                borderRadius: 24, paddingHorizontal: 14, height: 44,
              }}>
                <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
                <TextInput
                  style={{
                    flex: 1, marginLeft: 10, fontSize: 15,
                    color: theme.colors.text, paddingVertical: 0,
                  }}
                  placeholder="What do you want to listen to?"
                  placeholderTextColor={theme.colors.textSecondary + '90'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Song List */}
            {loading && songs.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>Finding songs...</Text>
              </View>
            ) : (
              <FlatList
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                data={songs}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => {
                  const isSelected = (selectedSong?._id === item._id);
                  return (
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row', alignItems: 'center',
                        paddingHorizontal: 16, paddingVertical: 10, gap: 12,
                      }}
                      onPress={() => handleSelect(item)}
                      activeOpacity={0.6}
                    >
                      {/* Album art — square with rounded corners */}
                      {item.imageUrl || item.thumbnailUrl ? (
                        <Image
                          source={{ uri: item.imageUrl || item.thumbnailUrl }}
                          style={{
                            width: 52, height: 52, borderRadius: 6,
                            backgroundColor: theme.colors.surfaceSecondary,
                          }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={{
                          width: 52, height: 52, borderRadius: 6,
                          backgroundColor: theme.colors.surfaceSecondary,
                          justifyContent: 'center', alignItems: 'center',
                        }}>
                          <Ionicons name="musical-note" size={22} color={theme.colors.textSecondary} />
                        </View>
                      )}

                      {/* Song info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{
                          fontSize: 15, fontWeight: '600', color: isSelected ? theme.colors.primary : theme.colors.text,
                          marginBottom: 3,
                        }} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.colors.textSecondary }} numberOfLines={1}>
                          {item.artist} · {formatDuration(item.duration)}
                        </Text>
                      </View>

                      {/* Right indicator */}
                      {isSelected ? (
                        <View style={{
                          width: 24, height: 24, borderRadius: 12,
                          backgroundColor: theme.colors.primary,
                          justifyContent: 'center', alignItems: 'center',
                        }}>
                          <Ionicons name="checkmark" size={15} color="#fff" />
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary + '60'} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => (
                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 80 }} />
                )}
                ListEmptyComponent={
                  <View style={{ padding: 60, alignItems: 'center', gap: 16 }}>
                    <Ionicons name="musical-notes-outline" size={56} color={theme.colors.textSecondary + '30'} />
                    <Text style={{ fontSize: 16, color: theme.colors.textSecondary, fontWeight: '500' }}>
                      No songs found
                    </Text>
                    <Text style={{ fontSize: 13, color: theme.colors.textSecondary + '80', textAlign: 'center' }}>
                      Try a different search term
                    </Text>
                  </View>
                }
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                  loading && songs.length > 0 ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color={theme.colors.primary} />
                    </View>
                  ) : null
                }
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={15}
                windowSize={10}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              />
            )}
          </KeyboardAvoidingView>
        )}

        {/* ==================== PAGE 2: TRIMMER (Spotify-style) ==================== */}
        {currentPage === 'trimmer' && currentSong && (
          <View style={{ flex: 1 }}>
            {/* Trimmer Header */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
            }}>
              <TouchableOpacity
                onPress={handleBackToList}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surfaceSecondary, justifyContent: 'center', alignItems: 'center' }}
              >
                <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
              </TouchableOpacity>
              <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary, letterSpacing: 0.3 }}>
                Trim Selection
              </Text>
              <TouchableOpacity
                onPress={handleConfirm}
                style={{
                  paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: theme.colors.primary,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Done</Text>
              </TouchableOpacity>
            </View>

            {/* Song card — centered content area */}
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
              {/* Album artwork with shadow */}
              <View style={{
                width: 200, height: 200, borderRadius: 12,
                backgroundColor: theme.colors.surfaceSecondary,
                overflow: 'hidden', marginBottom: 28,
                ...Platform.select({
                  ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 },
                  android: { elevation: 12 },
                }),
              }}>
                {currentSong.imageUrl || currentSong.thumbnailUrl ? (
                  <Image
                    source={{ uri: currentSong.imageUrl || currentSong.thumbnailUrl }}
                    style={{ width: 200, height: 200 }}
                  />
                ) : (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.primary + '12' }}>
                    <Ionicons name="musical-notes" size={72} color={theme.colors.primary + '60'} />
                  </View>
                )}
              </View>

              {/* Song title + artist */}
              <Text style={{
                fontSize: 22, fontWeight: '700', color: theme.colors.text,
                textAlign: 'center', marginBottom: 6, letterSpacing: 0.2,
              }} numberOfLines={2}>
                {currentSong.title}
              </Text>
              <Text style={{
                fontSize: 15, color: theme.colors.textSecondary,
                textAlign: 'center', marginBottom: 28,
              }} numberOfLines={1}>
                {currentSong.artist}
              </Text>

              {/* Playback controls row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 8 }}>
                {/* Time start */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.primary, minWidth: 40, textAlign: 'right' }}>
                  {formatDuration(startTime)}
                </Text>

                {/* Play/Pause — Spotify green circle */}
                <TouchableOpacity
                  onPress={playAudio}
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: theme.colors.primary,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={26} color="#fff"
                    style={isPlaying ? {} : { marginLeft: 3 }}
                  />
                </TouchableOpacity>

                {/* Time end */}
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.primary, minWidth: 40 }}>
                  {formatDuration(endTime)}
                </Text>
              </View>

              {/* Duration chip */}
              <View style={{
                paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12,
                backgroundColor: theme.colors.primary + '12',
              }}>
                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primary }}>
                  {Math.round(endTime - startTime)}s selected
                </Text>
              </View>
            </View>

            {/* Waveform trimmer — pinned to bottom */}
            {renderTimeline()}

            {/* Bottom actions */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingHorizontal: 16, paddingVertical: 14, gap: 12,
              borderTopWidth: 1, borderTopColor: theme.colors.border,
            }}>
              <TouchableOpacity
                onPress={handleBackToList}
                style={{
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 12, borderRadius: 24,
                  backgroundColor: theme.colors.surfaceSecondary,
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="swap-horizontal-outline" size={16} color={theme.colors.text} />
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>Change Song</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => { handleRemove(); setCurrentPage('list'); }}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: theme.colors.error + '12',
                  justifyContent: 'center', alignItems: 'center',
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    height: 8,
    borderRadius: 4,
    position: 'relative',
    marginBottom: 20,
    overflow: 'visible',
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  songIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 13,
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
  loopIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  loopIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trimBarLeft: {
    position: 'absolute',
    top: -16,
    width: 14,
    height: 40,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trimBarRight: {
    position: 'absolute',
    top: -16,
    width: 14,
    height: 40,
    borderTopLeftRadius: 2,
    borderBottomLeftRadius: 2,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -14 }],
  },
  trimBarActive: {
    transform: [{ scaleY: 1.1 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  barGrabIndicator: {
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barGrabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
