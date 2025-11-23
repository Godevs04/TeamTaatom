import React, { useState, useEffect, useRef } from 'react';
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
  Animated
} from 'react-native';
import { getSongs, Song } from '../services/songs';
import { useTheme } from '../context/ThemeContext';
import logger from '../utils/logger';
import { Audio } from 'expo-av';

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
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(selectedStartTime);
  const [endTime, setEndTime] = useState(selectedEndTime);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'both' | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const startHandleAnim = useRef(new Animated.Value(0)).current;
  const endHandleAnim = useRef(new Animated.Value(0)).current;
  const timelineWidthRef = useRef<number>(SCREEN_WIDTH - 32);

  useEffect(() => {
    if (visible) {
      loadSongs();
      if (selectedSong) {
        setCurrentSong(selectedSong);
        setStartTime(selectedStartTime);
        setEndTime(selectedEndTime);
      }
    } else {
      // Reset when modal closes
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

  useEffect(() => {
    if (currentSong && isPlaying) {
      const interval = setInterval(async () => {
        if (soundRef.current) {
          try {
            const status = await soundRef.current.getStatusAsync();
            if (status.isLoaded) {
              const time = status.positionMillis / 1000;
              setCurrentTime(time);
              
              // Stop if reached end time
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
      }, 100);

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
      endHandleAnim.setValue(endProgress);
    }
  }, [currentTime, startTime, endTime, currentSong]);

  const loadSongs = async (pageNum: number = 1) => {
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
  };

  useEffect(() => {
    if (visible) {
      // Debounce search
      const timer = setTimeout(() => {
        setPage(1);
        setSongs([]);
        loadSongs(1);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [searchQuery, visible]);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      loadSongs(page + 1);
    }
  };

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

  const handleSelect = async (song: Song) => {
    await loadAudio(song);
  };

  const handleConfirm = () => {
    if (currentSong) {
      // Ensure endTime doesn't exceed song duration
      const maxEndTime = Math.min(endTime, currentSong.duration || MAX_SELECTION_DURATION);
      // Ensure selection is max 60 seconds
      const finalEndTime = Math.min(maxEndTime, startTime + MAX_SELECTION_DURATION);
      
      // Ensure selection is at least 1 second
      if (finalEndTime <= startTime) {
        Alert.alert('Invalid Selection', 'Please select at least 1 second of the song.');
        return;
      }
      
      onSelect(currentSong, startTime, finalEndTime);
    } else if (selectedSong) {
      // Ensure selection is max 60 seconds
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

  // Create separate pan responders for start and end handles
  const startHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setIsDragging(true);
      setDragType('start');
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      const x = evt.nativeEvent.locationX;
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(x, duration);
      
      const newStart = Math.max(0, Math.min(time, endTime - 1));
      const maxEnd = Math.min(duration, newStart + MAX_SELECTION_DURATION);
      setStartTime(newStart);
      if (endTime > maxEnd) {
        setEndTime(maxEnd);
      }
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
    },
  });

  const endHandlePanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setIsDragging(true);
      setDragType('end');
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      const x = evt.nativeEvent.locationX;
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(x, duration);
      
      const maxEnd = Math.min(duration, startTime + MAX_SELECTION_DURATION);
      const newEnd = Math.min(maxEnd, Math.max(time, startTime + 1));
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
    },
  });

  // Pan responder for the selection area (to move the whole selection)
  const selectionPanResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      setIsDragging(true);
      setDragType('both');
    },
    onPanResponderMove: (evt) => {
      if (!currentSong || !isDragging) return;
      const x = evt.nativeEvent.locationX;
      const duration = currentSong.duration || 0;
      const time = getTimeFromPosition(x, duration);
      
      const selectionDuration = Math.min(endTime - startTime, MAX_SELECTION_DURATION);
      const newStart = Math.max(0, Math.min(time, duration - selectionDuration));
      const newEnd = Math.min(duration, newStart + selectionDuration);
      setStartTime(newStart);
      setEndTime(newEnd);
    },
    onPanResponderRelease: () => {
      setIsDragging(false);
      setDragType(null);
    },
  });

  const renderTimeline = () => {
    if (!currentSong) return null;

    const duration = currentSong.duration || 0;
    const startPercent = duration > 0 ? (startTime / duration) * 100 : 0;
    const endPercent = duration > 0 ? (endTime / duration) * 100 : 0;
    const selectionDuration = endTime - startTime;
    const isMaxDuration = selectionDuration >= MAX_SELECTION_DURATION;

    return (
      <View style={[styles.timelineContainer, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineTitle, { color: theme.colors.text }]}>Select up to 60 seconds</Text>
          <View style={[styles.durationBadge, isMaxDuration && { backgroundColor: theme.colors.error + '20' }]}>
            <Text style={[styles.timelineDuration, { color: isMaxDuration ? theme.colors.error : theme.colors.primary }]}>
              {formatDuration(selectionDuration)} / {formatDuration(MAX_SELECTION_DURATION)}
              {isMaxDuration && ' (Max)'}
            </Text>
          </View>
        </View>
        
        <View 
          style={styles.timelineWrapper} 
          onLayout={(event) => {
            timelineWidthRef.current = event.nativeEvent.layout.width;
          }}
        >
          <View style={[styles.timelineTrack, { backgroundColor: theme.colors.border }]}>
            <View 
              style={[
                styles.timelineSelection,
                {
                  left: `${startPercent}%`,
                  width: `${endPercent - startPercent}%`,
                  backgroundColor: theme.colors.primary,
                }
              ]}
              {...selectionPanResponder.panHandlers}
            />
            <Animated.View
              style={[
                styles.timelineProgress,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: theme.colors.primary + '40',
                }
              ]}
            />
            <Animated.View
              style={[
                styles.timelineHandle,
                styles.startHandle,
                {
                  left: startHandleAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.background,
                }
              ]}
              {...startHandlePanResponder.panHandlers}
            >
              <View style={[styles.handleInner, { backgroundColor: theme.colors.background }]} />
            </Animated.View>
            <Animated.View
              style={[
                styles.timelineHandle,
                styles.endHandle,
                {
                  left: endHandleAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  }),
                  backgroundColor: theme.colors.primary,
                  borderColor: theme.colors.background,
                }
              ]}
              {...endHandlePanResponder.panHandlers}
            >
              <View style={[styles.handleInner, { backgroundColor: theme.colors.background }]} />
            </Animated.View>
          </View>
          
          <View style={styles.timelineLabels}>
            <Text style={[styles.timelineLabel, { color: theme.colors.textSecondary }]}>{formatDuration(startTime)}</Text>
            <Text style={[styles.timelineLabel, { color: theme.colors.textSecondary }]}>{formatDuration(endTime)}</Text>
          </View>
        </View>

        <View style={styles.timelineControls}>
          <TouchableOpacity 
            onPress={playAudio} 
            style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.7}
          >
            <Text style={styles.playButtonText}>{isPlaying ? '⏸' : '▶'}</Text>
          </TouchableOpacity>
          <View style={styles.timeDisplayContainer}>
            <Text style={[styles.timeDisplay, { color: theme.colors.text }]}>
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.timelineHint, { color: theme.colors.textSecondary }]}>
          Drag the handles to select your 60-second clip
        </Text>
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
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={[styles.cancelButtonText, { color: theme.colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Select Music</Text>
          <TouchableOpacity 
            onPress={handleConfirm} 
            style={styles.doneButton}
            disabled={!currentSong && !selectedSong}
          >
            <Text style={[
              styles.doneButtonText, 
              { color: theme.colors.primary },
              (!currentSong && !selectedSong) && styles.doneButtonDisabled
            ]}>
              Done
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { borderBottomColor: theme.colors.border }]}>
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                borderColor: theme.colors.border,
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
                  <View style={styles.songInfo}>
                    <Text style={[
                      styles.songTitle,
                      { color: theme.colors.text },
                      isSelected && { color: theme.colors.primary }
                    ]}>
                      {item.title}
                    </Text>
                    <Text style={[
                      styles.songArtist,
                      { color: theme.colors.textSecondary },
                      isSelected && { color: theme.colors.primary + 'CC' }
                    ]}>
                      {item.artist} • {formatDuration(item.duration)}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                      <Text style={styles.checkmarkText}>✓</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No songs found</Text>
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
          />
        )}

        {(currentSong || selectedSong) && (
          <View style={[styles.selectedContainer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <View style={styles.selectedInfo}>
              <Text style={[styles.selectedLabel, { color: theme.colors.textSecondary }]}>Selected:</Text>
              <Text style={[styles.selectedSongName, { color: theme.colors.text }]}>
                {(currentSong || selectedSong)?.title} - {(currentSong || selectedSong)?.artist}
              </Text>
              <Text style={[styles.selectedTime, { color: theme.colors.primary }]}>
                {formatDuration(startTime)} - {formatDuration(endTime)}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={handleRemove} 
              style={[styles.removeButton, { backgroundColor: theme.colors.error }]}
              activeOpacity={0.7}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
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
    padding: 16,
    borderBottomWidth: 1,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  doneButton: {
    padding: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
  },
  searchInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  timelineContainer: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  timelineTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  durationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  timelineDuration: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineWrapper: {
    marginBottom: 20,
  },
  timelineTrack: {
    height: 6,
    borderRadius: 3,
    position: 'relative',
    marginBottom: 12,
  },
  timelineSelection: {
    position: 'absolute',
    height: '100%',
    borderRadius: 3,
    zIndex: 2,
  },
  timelineProgress: {
    position: 'absolute',
    height: '100%',
    borderRadius: 3,
    zIndex: 1,
  },
  timelineHandle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    top: -9,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startHandle: {
    marginLeft: -12,
  },
  endHandle: {
    marginLeft: -12,
  },
  handleInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timelineLabel: {
    fontSize: 12,
  },
  timelineControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  playButtonText: {
    fontSize: 20,
    color: '#fff',
  },
  timeDisplayContainer: {
    minWidth: 100,
    alignItems: 'center',
  },
  timeDisplay: {
    fontSize: 14,
    fontWeight: '600',
  },
  timelineHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  songItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  selectedContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  selectedSongName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  selectedTime: {
    fontSize: 12,
    fontWeight: '500',
  },
  removeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
