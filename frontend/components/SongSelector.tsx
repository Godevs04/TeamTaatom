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
  Platform
} from 'react-native';
import { getSongs, Song } from '../services/songs';
import { useTheme } from '../context/ThemeContext';
import logger from '../utils/logger';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_SELECTION_DURATION = 60; // 60 seconds max

interface SongSelectorProps {
  onSelect: (song: Song | null, startTime?: number, endTime?: number) => void;
  selectedSong: Song | null;
  selectedStartTime?: number;
  selectedEndTime?: number;
  visible: boolean;
  onClose: () => void;
}

export const SongSelector: React.FC<SongSelectorProps> = ({
  onSelect,
  selectedSong,
  selectedStartTime = 0,
  selectedEndTime = MAX_SELECTION_DURATION,
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
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const startHandleAnim = useRef(new Animated.Value(0)).current;
  const endHandleAnim = useRef(new Animated.Value(0)).current;
  const timelineWidthRef = useRef<number>(SCREEN_WIDTH - 64);
  const lastDragXRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      loadSongs();
      if (selectedSong) {
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
    }
  }, [visible]);

  useEffect(() => {
    if (visible && selectedSong) {
      setCurrentSong(selectedSong);
      setStartTime(selectedStartTime);
      setEndTime(selectedEndTime);
    }
  }, [selectedSong, selectedStartTime, selectedEndTime, visible]);

  // Optimized audio status polling - reduce frequency to 200ms for better performance
  useEffect(() => {
    if (currentSong && isPlaying && soundRef.current) {
      const interval = setInterval(async () => {
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              const time = status.positionMillis / 1000;
              setCurrentTime(time);
              
              if (endTime && time >= endTime) {
                await soundRef.current.pauseAsync();
                await soundRef.current.setPositionAsync(startTime * 1000);
                setIsPlaying(false);
                setCurrentTime(startTime);
              }
            }
          } catch (error) {
            logger.error('Error getting audio status:', error);
          }
        }
      }, 200); // Reduced from 100ms to 200ms for better performance

      return () => clearInterval(interval);
    }
  }, [currentSong, isPlaying, startTime, endTime]);

  useEffect(() => {
    if (currentSong) {
      const duration = currentSong.duration || 0;
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      const startProgress = duration > 0 ? (startTime / duration) * 100 : 0;
      const endProgress = duration > 0 ? (endTime / duration) * 100 : 0;
      
      progressAnim.setValue(progress);
      startHandleAnim.setValue(startProgress);
      // Ensure end handle doesn't go beyond 100% (clamp to max)
      endHandleAnim.setValue(Math.min(endProgress, 100));
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

  const loadAudio = async (song: Song) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: song.s3Url },
        { shouldPlay: false }
      );
      
      soundRef.current = sound;
      setCurrentSong(song);
      setCurrentTime(0);
      setStartTime(0);
      setEndTime(Math.min(MAX_SELECTION_DURATION, song.duration || MAX_SELECTION_DURATION));
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
        await soundRef.current.setPositionAsync(startTime * 1000);
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      logger.error('Error playing audio:', error);
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      } catch (error) {
        logger.error('Error stopping audio:', error);
      }
    }
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleSelect = useCallback(async (song: Song) => {
    await loadAudio(song);
  }, []);

  const handleConfirm = () => {
    if (currentSong) {
      const maxEndTime = Math.min(endTime, currentSong.duration || MAX_SELECTION_DURATION);
      const finalEndTime = Math.min(maxEndTime, startTime + MAX_SELECTION_DURATION);
      
      if (finalEndTime <= startTime) {
        Alert.alert('Invalid Selection', 'Please select at least 1 second of the song.');
        return;
      }
      
      onSelect(currentSong, startTime, finalEndTime);
    } else if (selectedSong) {
      const finalEndTime = Math.min(endTime, startTime + MAX_SELECTION_DURATION);
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
    setEndTime(MAX_SELECTION_DURATION);
    onSelect(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = (x: number, duration: number) => {
    const width = timelineWidthRef.current;
    const progress = Math.max(0, Math.min(100, (x / width) * 100));
    return (progress / 100) * duration;
  };

  const snapToPrecision = (time: number): number => {
    return Math.round(time * 10) / 10;
  };

  const MIN_DRAG_DELTA = 2;

  // Quick adjust functions for better UX
  const adjustStartTime = (delta: number) => {
    if (!currentSong) return;
    const duration = currentSong.duration || 0;
    const newStart = Math.max(0, Math.min(startTime + delta, endTime - 1));
    const maxEnd = Math.min(duration, newStart + MAX_SELECTION_DURATION);
    setStartTime(newStart);
    if (endTime > maxEnd) {
      setEndTime(maxEnd);
    }
  };

  const adjustEndTime = (delta: number) => {
    if (!currentSong) return;
    const duration = currentSong.duration || 0;
    const maxEnd = Math.min(duration, startTime + MAX_SELECTION_DURATION);
    const newEnd = Math.min(maxEnd, Math.max(endTime + delta, startTime + 1));
    setEndTime(newEnd);
  };

  const startHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      setDragType('start');
      lastDragXRef.current = evt.nativeEvent.locationX;
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      
      const currentX = evt.nativeEvent.locationX;
      const lastX = lastDragXRef.current;
      
      if (lastX !== null && Math.abs(currentX - lastX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(currentX, duration);
      const snappedTime = snapToPrecision(time);
      
      const newStart = Math.max(0, Math.min(snappedTime, endTime - 1));
      const maxEnd = Math.min(duration, newStart + MAX_SELECTION_DURATION);
      setStartTime(newStart);
      if (endTime > maxEnd) {
        setEndTime(maxEnd);
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
    },
  });

  const endHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      setDragType('end');
      lastDragXRef.current = evt.nativeEvent.locationX;
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      
      const currentX = evt.nativeEvent.locationX;
      const lastX = lastDragXRef.current;
      
      if (lastX !== null && Math.abs(currentX - lastX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(currentX, duration);
      const snappedTime = snapToPrecision(time);
      
      const maxEnd = Math.min(duration, startTime + MAX_SELECTION_DURATION);
      const newEnd = Math.min(maxEnd, Math.max(snappedTime, startTime + 1));
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
    },
  });

  const selectionPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      setIsDragging(true);
      setDragType('both');
      lastDragXRef.current = evt.nativeEvent.locationX;
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      
      const currentX = evt.nativeEvent.locationX;
      const lastX = lastDragXRef.current;
      
      if (lastX !== null && Math.abs(currentX - lastX) < MIN_DRAG_DELTA) {
        return;
      }
      lastDragXRef.current = currentX;
      
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(currentX, duration);
      const snappedTime = snapToPrecision(time);
      
      const selectionDuration = Math.min(endTime - startTime, MAX_SELECTION_DURATION);
      const newStart = Math.max(0, Math.min(snappedTime, duration - selectionDuration));
      const newEnd = Math.min(duration, newStart + selectionDuration);
      setStartTime(newStart);
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
      lastDragXRef.current = null;
    },
  });

  const renderTimeline = () => {
    if (!currentSong) return null;

    const duration = currentSong.duration || 0;
    const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPercent = duration > 0 ? (endTime / duration) * 100 : 0;
    const selectionDuration = endTime - startTime;
    const isMaxDuration = selectionDuration >= MAX_SELECTION_DURATION;

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
                {formatDuration(selectionDuration)} / {formatDuration(MAX_SELECTION_DURATION)}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Enhanced Timeline with Waveform */}
        <View style={[styles.timelineSection, { overflow: 'visible' }]}>
          <View 
            style={[styles.timelineWrapper, { overflow: 'visible' }]} 
            onLayout={(event) => {
              timelineWidthRef.current = event.nativeEvent.layout.width;
            }}
          >
            {/* Waveform Visualization */}
            <View style={styles.waveformContainer}>
              {waveformBars.map((bar, index) => (
                <View
                  key={index}
                  style={[
                    styles.waveformBar,
                    {
                      height: bar.height,
                      backgroundColor: bar.isInSelection
                        ? theme.colors.primary
                        : bar.isPlaying
                        ? theme.colors.primary + '60'
                        : theme.colors.border,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Timeline Track */}
            <View style={[styles.timelineTrack, { backgroundColor: theme.colors.border + '40', overflow: 'visible' }]}>
              {/* Selection Area */}
              <View 
                style={[
                  styles.timelineSelection,
                  {
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                  }
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
              <Animated.View
                style={[
                  styles.timelineProgress,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                    backgroundColor: theme.colors.primary + '30',
                  }
                ]}
              />

              {/* Start Handle - Much Larger */}
              <Animated.View
                style={[
                  styles.timelineHandle,
                  styles.startHandle,
                  {
                    left: startHandleAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                    transform: [
                      { translateX: -28 } // Center handle on position (half of 56px width)
                    ],
                  }
                ]}
                {...startHandlePanResponder.panHandlers}
                hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.handleGradient}
                >
                  <View style={styles.handleInner} />
                  <Ionicons name="chevron-back" size={16} color="#fff" style={styles.handleIcon} />
                </LinearGradient>
              </Animated.View>

              {/* End Handle - Much Larger */}
              <Animated.View
                style={[
                  styles.timelineHandle,
                  styles.endHandle,
                  {
                    left: endHandleAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                    transform: [
                      { translateX: -28 } // Center handle on position (half of 56px width)
                    ],
                  }
                ]}
                {...endHandlePanResponder.panHandlers}
                hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
              >
                <LinearGradient
                  colors={[theme.colors.primary, theme.colors.secondary]}
                  style={styles.handleGradient}
                >
                  <View style={styles.handleInner} />
                  <Ionicons name="chevron-forward" size={16} color="#fff" style={styles.handleIcon} />
                </LinearGradient>
              </Animated.View>
            </View>

            {/* Time Labels */}
            <View style={styles.timelineLabels}>
              <View style={styles.timeLabelContainer}>
                <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
                  {formatDuration(startTime)}
                </Text>
                <Text style={[styles.timeLabelHint, { color: theme.colors.textSecondary + '80' }]}>
                  Start
                </Text>
              </View>
              <View style={styles.timeLabelContainer}>
                <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>
                  {formatDuration(endTime)}
                </Text>
                <Text style={[styles.timeLabelHint, { color: theme.colors.textSecondary + '80' }]}>
                  End
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Adjust Buttons */}
          <View style={styles.quickAdjustContainer}>
            <View style={styles.quickAdjustGroup}>
              <Text style={[styles.quickAdjustLabel, { color: theme.colors.textSecondary }]}>Start</Text>
              <TouchableOpacity
                onPress={() => adjustStartTime(-5)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>5s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustStartTime(-1)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustStartTime(1)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustStartTime(5)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>5s</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.quickAdjustGroup, styles.quickAdjustGroupEnd]}>
              <Text style={[styles.quickAdjustLabel, { color: theme.colors.textSecondary }]}>End</Text>
              <TouchableOpacity
                onPress={() => adjustEndTime(-5)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={18} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>5s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustEndTime(-1)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="remove" size={16} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustEndTime(1)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => adjustEndTime(5)}
                style={[styles.quickAdjustButton, { backgroundColor: theme.colors.surfaceSecondary }]}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={theme.colors.text} />
                <Text style={[styles.quickAdjustText, { color: theme.colors.text }]}>5s</Text>
              </TouchableOpacity>
            </View>
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
                  <View style={[styles.songIconContainer, { backgroundColor: theme.colors.primary + '20' }]}>
                    <Ionicons 
                      name={isSelected ? "musical-notes" : "musical-note-outline"} 
                      size={24} 
                      color={isSelected ? theme.colors.primary : theme.colors.textSecondary} 
                    />
                  </View>
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
    height: 8,
    borderRadius: 4,
    position: 'relative',
    marginBottom: 16,
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
    width: 56,
    height: 56,
    borderRadius: 28,
    top: -24,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startHandle: {
    // marginLeft handled inline to work with Animated
  },
  endHandle: {
    // marginLeft handled inline to work with Animated
  },
  handleGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginBottom: 2,
  },
  handleIcon: {
    position: 'absolute',
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  timeLabelContainer: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  timeLabelHint: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickAdjustContainer: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 12,
  },
  quickAdjustGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-start',
  },
  quickAdjustGroupEnd: {
    marginTop: 0, // No extra margin, gap handles spacing
  },
  quickAdjustLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
    minWidth: 40,
  },
  quickAdjustButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  quickAdjustText: {
    fontSize: 12,
    fontWeight: '600',
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
});
