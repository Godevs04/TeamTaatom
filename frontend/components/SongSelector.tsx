import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
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
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { getSongs, Song } from '../services/songs';
import { useTheme } from '../context/ThemeContext';
import { useIsFocused } from '@react-navigation/native';
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

// Memoized waveform — bars only re-render when the song or its duration changes.
// Without this, every drag tick (setStartTime/setEndTime) re-runs the 80-300 bar
// math + recreates that many <View> children, which is the primary cause of
// laggy trim handles and scroll on the trimmer page.
type WaveformBarsProps = {
  duration: number;
  barColor: string;
  totalWidth: number;
  numBars: number;
};
const WaveformBars: React.FC<WaveformBarsProps> = memo(({ duration, barColor, totalWidth, numBars }) => {
  const { bars, barWidth, barGap } = useMemo(() => {
    const barTotalWidth = totalWidth / numBars;
    const w = Math.max(2, barTotalWidth * 0.55);
    const gap = (barTotalWidth - w) / 2;
    const arr = Array.from({ length: numBars }, (_, i) => {
      const base = 8;
      const wave =
        Math.sin(i * 0.18) * 16 +
        Math.cos(i * 0.32) * 12 +
        Math.sin(i * 0.55) * 8 +
        Math.cos(i * 0.12) * 6;
      return Math.max(4, base + wave);
    });
    return { bars: arr, barWidth: w, barGap: gap };
  }, [totalWidth, numBars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 64 }}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            marginHorizontal: barGap,
            height: h,
            borderRadius: barWidth,
            backgroundColor: barColor,
            opacity: 0.85,
          }}
        />
      ))}
    </View>
  );
}, (prev, next) =>
  prev.duration === next.duration &&
  prev.barColor === next.barColor &&
  prev.totalWidth === next.totalWidth &&
  prev.numBars === next.numBars
);

// Memoized song-list row. Without this, every render of SongSelector (e.g. on
// every audio status tick) recreates renderItem and re-renders all visible rows.
// expo-image is used for album art so thumbnails are cached across opens / scrolls.
type SongRowProps = {
  item: Song;
  isSelected: boolean;
  isLoading: boolean;
  onPress: (song: Song) => void;
  textColor: string;
  selectedColor: string;
  secondaryColor: string;
  surfaceColor: string;
  durationLabel: string;
};
const SongRow: React.FC<SongRowProps> = memo(({
  item,
  isSelected,
  isLoading,
  onPress,
  textColor,
  selectedColor,
  secondaryColor,
  surfaceColor,
  durationLabel,
}) => {
  const art = item.imageUrl || item.thumbnailUrl;
  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10, gap: 12,
        opacity: isLoading ? 0.6 : 1,
      }}
      onPress={() => onPress(item)}
      disabled={isLoading}
      activeOpacity={0.6}
    >
      {art ? (
        <ExpoImage
          source={{ uri: art }}
          style={{
            width: 52, height: 52, borderRadius: 6,
            backgroundColor: surfaceColor,
          }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={120}
        />
      ) : (
        <View style={{
          width: 52, height: 52, borderRadius: 6,
          backgroundColor: surfaceColor,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="musical-note" size={22} color={secondaryColor} />
        </View>
      )}

      <View style={{ flex: 1 }}>
        <Text style={{
          fontSize: 15, fontWeight: '600',
          color: isSelected ? selectedColor : textColor,
          marginBottom: 3,
        }} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 13, color: secondaryColor }} numberOfLines={1}>
          {item.artist} · {durationLabel}
        </Text>
      </View>

      {isLoading ? (
        <ActivityIndicator size="small" color={selectedColor} />
      ) : isSelected ? (
        <View style={{
          width: 24, height: 24, borderRadius: 12,
          backgroundColor: selectedColor,
          justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="checkmark" size={15} color="#fff" />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={secondaryColor + '60'} />
      )}
    </TouchableOpacity>
  );
});

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
  // ID of the song whose audio is being loaded after a row tap; used to show
  // an inline spinner so the tap feels responsive instead of "did anything happen?".
  const [loadingSongId, setLoadingSongId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<'list' | 'trimmer'>('list');
  const [isPlaying, setIsPlaying] = useState(false);

  const isFocused = useIsFocused();

  // Stop preview when screen loses focus (user navigates away)
  useEffect(() => {
    if (!isFocused) {
      stopAudio();
    }
  }, [isFocused]);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(selectedStartTime);
  const [endTime, setEndTime] = useState(selectedEndTime);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'start' | 'end' | 'both' | null>(null);
  const [limitState, setLimitState] = useState<'normal' | 'approachingMin' | 'atMinimum' | 'atMaximum'>('normal');
  const [dragTime, setDragTime] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timelineWidthRef = useRef<number>(SCREEN_WIDTH - 64);
  const timelineLayoutRef = useRef<{ x: number; width: number } | null>(null);
  const lastDragXRef = useRef<number | null>(null);
  const waveformScrollRef = useRef<any>(null);
  const scrollOffsetRef = useRef<number>(0);
  const selectionDurationRef = useRef<number>(MAX_SELECTION_DURATION);
  const currentSongRef = useRef<Song | null>(null);
  const startTimeRef = useRef<number>(0);
  const endTimeRef = useRef<number>(MAX_SELECTION_DURATION);
  // Mirror isPlaying so the audio-status polling interval (which closes
  // over state at setup time) can see the latest value mid-tick. Without
  // this, pausing near the end of the clip raced with the loop-branch's
  // playAsync — audio resumed itself while the button stayed on "play".
  const isPlayingRef = useRef<boolean>(false);
  // Single in-flight guard for the play/pause toggle so a rapid double-tap
  // doesn't fire setPositionAsync + playAsync concurrently with a pending
  // pauseAsync against the same Audio.Sound (which expo-av handles
  // erratically on Android).
  const playToggleInFlightRef = useRef<boolean>(false);
  const trimGrantRef = useRef<{ startTime: number; endTime: number } | null>(null);
  const trimStartRef = useRef({ initialX: 0, initialStartTime: 0 });
  const trimEndRef = useRef({ initialX: 0, initialEndTime: 0 });
  const maxSelectionRef = useRef<number>(MAX_SELECTION_DURATION);
  const lastTapRef = useRef<number>(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timelinePaddingRef = useRef<number>(28); // Padding from timelineWrapper
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef<boolean>(false); // Sync ref to avoid stale closure in PanResponder
  const lastSearchQueryRef = useRef<string>(''); // tracks last query we kicked a search for; prevents double-load on modal open

  useEffect(() => {
    if (visible) {
      // Immediate first load — the search-debounce effect below skips on visible
      // transitions so we only fire one request when the modal opens.
      loadSongs(1);
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
      // Reset the "last query we searched for" tracker so reopening the modal
      // never double-fires (open-load + debounce chasing a stale prev query).
      lastSearchQueryRef.current = '';

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

  // Audio status polling. Reads startTime/endTime via refs so dragging the trim
  // handles (which rapidly mutates those values) does NOT recreate the interval
  // 60+ times a second. Skips currentTime state updates while the user is
  // dragging to avoid extra renders on top of the per-move setStartTime/setEndTime.
  useEffect(() => {
    if (!currentSong || !isPlaying || !soundRef.current) return;

    const interval = setInterval(async () => {
      // The user may have paused between the previous tick scheduling and
      // this tick firing. Without this guard, the loop-branch below would
      // call playAsync on a sound the user just paused — audio resumes
      // while the button stays on "play".
      if (!isPlayingRef.current) return;
      const sound = soundRef.current;
      if (!sound) return;
      try {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) return;

        const time = status.positionMillis / 1000;
        const start = startTimeRef.current;
        const end = endTimeRef.current;

        // Skip the React state update while the user is dragging — the
        // drag itself owns the visible state, and adding currentTime renders
        // on top causes the trim handles to feel laggy.
        if (!isDraggingRef.current) {
          setCurrentTime(time);
        }

        // Loop playback: when reaching endTime, restart from startTime so
        // the preview matches the eventual video clip duration.
        if (end && time >= end) {
          try {
            await sound.setPositionAsync(start * 1000);
            if (!isDraggingRef.current) setCurrentTime(start);
            // Re-check the ref after the await — the user may have paused
            // while we were repositioning.
            if (!status.isPlaying && isPlayingRef.current) {
              await sound.playAsync();
            }
          } catch (loopError) {
            logger.warn('Error looping playback:', loopError);
            await sound.pauseAsync();
            setIsPlaying(false);
            setCurrentTime(start);
          }
        }
      } catch (error) {
        logger.error('Error getting audio status:', error);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentSong, isPlaying]);

  // Note: previous versions wrote progressAnim / startHandleAnim / endHandleAnim
  // here on every currentTime tick — but those Animated.Values were never bound
  // to any <Animated.View> in the JSX, so the work was thrown away. Removed to
  // stop ~5 setValue() calls per 200ms while playing.

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
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

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

  // Debounced search — only fires on USER-driven searchQuery changes. The
  // visible-effect above handles the immediate first load when the modal opens,
  // so this effect tracks the "last query we kicked a search for" (via
  // lastSearchQueryRef declared above) and skips when the query hasn't actually
  // changed.
  useEffect(() => {
    if (!visible) return;
    if (searchQuery === lastSearchQueryRef.current) return;
    lastSearchQueryRef.current = searchQuery;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    setPage(1);
    setSongs([]);

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

      const { sound, status } = await Audio.Sound.createAsync(
        { uri: song.s3Url },
        {
          shouldPlay: false,
          progressUpdateIntervalMillis: 200, // Update every 200ms for smooth looping
          isLooping: false // We handle looping manually to respect startTime/endTime
        },
        null,
        false // Disable downloadFirst to enable instant streaming
      );

      soundRef.current = sound;

      // Songs uploaded before migration 005 may have duration=0/undefined.
      // Read the real duration from the loaded sound so the trim slider math
      // downstream in SongBar is not based on the 30s fallback.
      let actualDurationSec = song.duration;
      const initialMillis = status && status.isLoaded ? status.durationMillis : null;
      if (typeof initialMillis === 'number' && initialMillis > 0) {
        actualDurationSec = initialMillis / 1000;
      } else {
        try {
          const liveStatus = await sound.getStatusAsync();
          if (liveStatus.isLoaded && typeof liveStatus.durationMillis === 'number' && liveStatus.durationMillis > 0) {
            actualDurationSec = liveStatus.durationMillis / 1000;
          }
        } catch (_) { /* fall through to existing value */ }
      }
      const correctedSong: Song = {
        ...song,
        duration: actualDurationSec && actualDurationSec > 0 ? actualDurationSec : MAX_SELECTION_DURATION,
      };
      setCurrentSong(correctedSong);

      // Use video duration if provided, otherwise use song duration or max
      const maxDuration = getMaxSelectionDuration();
      const songDuration = correctedSong.duration;
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
    // Reject re-entry: a double-tap on the toggle within ~50ms would
    // otherwise queue pauseAsync + playAsync (or vice-versa) on the same
    // expo-av Audio.Sound, which on Android sometimes leaves the player
    // in a stuck state where neither button matches the audio state.
    if (playToggleInFlightRef.current) return;
    playToggleInFlightRef.current = true;

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
    } finally {
      playToggleInFlightRef.current = false;
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
    // Show a per-row spinner while the audio resolves so the tap is never silent.
    // Page switch happens AFTER load so the trimmer renders with audio ready
    // (otherwise the trimmer briefly shows 0:00 / no playback while createAsync runs).
    setLoadingSongId(song._id);
    try {
      await loadAudio(song);
      setCurrentPage('trimmer');
    } finally {
      setLoadingSongId(null);
    }
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
      isDraggingRef.current = true;
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

      // Only commit to React state if the snapped value actually changed —
      // saves redundant renders when the finger moves within a single 0.1s tick.
      if (newStart !== startTimeRef.current) {
        startTimeRef.current = newStart;
        selectionDurationRef.current = endTimeRef.current - newStart;
        setStartTime(newStart);
      }

      // Scroll to keep waveform aligned with new start position
      waveformScrollRef.current?.scrollTo({ x: newStart * pps, animated: false });
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      hapticLight();
      if (soundRef.current) {
        soundRef.current.setPositionAsync(startTimeRef.current * 1000).catch(() => {});
        setCurrentTime(startTimeRef.current);
      }
    },
    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
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
      isDraggingRef.current = true;
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

      if (newEnd !== endTimeRef.current) {
        endTimeRef.current = newEnd;
        selectionDurationRef.current = newEnd - startTimeRef.current;
        setEndTime(newEnd);
      }
    },
    onPanResponderRelease: () => {
      isDraggingRef.current = false;
      hapticLight();
    },
    onPanResponderTerminate: () => {
      isDraggingRef.current = false;
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

    // Bars proportional to song length (~3 bars per second, max 300).
    // Bar generation/rendering is delegated to <WaveformBars> which is memo'd
    // so the 300-bar tree does NOT re-render during drag/poll.
    const NUM_BARS = Math.min(300, Math.max(80, Math.ceil(duration * 3)));

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
            <WaveformBars
              duration={duration}
              barColor={theme.colors.primary}
              totalWidth={totalWaveformWidth}
              numBars={NUM_BARS}
            />
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

  // Stable list callbacks — prevent FlatList rows from re-rendering on every
  // poll tick / drag tick while the modal is open.
  const keyExtractor = useCallback((item: Song) => item._id, []);
  const renderSongItem = useCallback(({ item }: { item: Song }) => {
    const isSelected = selectedSong?._id === item._id;
    const isLoading = loadingSongId === item._id;
    return (
      <SongRow
        item={item}
        isSelected={isSelected}
        isLoading={isLoading}
        onPress={handleSelect}
        textColor={theme.colors.text}
        selectedColor={theme.colors.primary}
        secondaryColor={theme.colors.textSecondary}
        surfaceColor={theme.colors.surfaceSecondary}
        durationLabel={formatDuration(item.duration)}
      />
    );
  }, [selectedSong?._id, loadingSongId, handleSelect, theme.colors.text, theme.colors.primary, theme.colors.textSecondary, theme.colors.surfaceSecondary]);

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
                keyExtractor={keyExtractor}
                renderItem={renderSongItem}
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
                  <ExpoImage
                    source={{ uri: currentSong.imageUrl || currentSong.thumbnailUrl }}
                    style={{ width: 200, height: 200 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
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
