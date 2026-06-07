import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Audio } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { Song } from '../services/songs';

interface SongBarProps {
  song: Song;
  startTime: number;
  endTime: number;
  songDuration: number;
  onTrimChange: (startTime: number, endTime: number) => void;
  onOpenSelector: () => void;
  onRemove: () => void;
}

const BLUE_ICON_GRADIENT = ['#38BDF8', '#2563EB'] as const;

const GradientIonicon = ({
  name,
  size,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size: number;
}) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={<Ionicons name={name} size={size} color="#000" />}
  >
    <LinearGradient
      colors={BLUE_ICON_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    />
  </MaskedView>
);

export const SongBar: React.FC<SongBarProps> = ({
  song,
  startTime,
  endTime,
  songDuration,
  onTrimChange,
  onOpenSelector,
  onRemove,
}) => {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const isFocused = useIsFocused();

  // Pause preview when screen loses focus
  useEffect(() => {
    if (!isFocused && isPlaying && soundRef.current) {
      soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
    }
  }, [isFocused, isPlaying]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  // Play/pause preview
  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying && soundRef.current) {
        await soundRef.current?.pauseAsync().catch(() => {});
        setIsPlaying(false);
        if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
        return;
      }

      if (!soundRef.current) {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          interruptionModeIOS: 0,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: song.s3Url },
          { shouldPlay: true, isLooping: false },
          null,
          false // Disable downloadFirst to enable instant streaming
        );
        soundRef.current = sound;
      } else {
        await soundRef.current?.setPositionAsync(0).catch(() => {});
        await soundRef.current?.playAsync().catch(() => {});
      }

      setIsPlaying(true);

      // Poll status — stop at end of song
      statusIntervalRef.current = setInterval(async () => {
        if (!soundRef.current || !isMountedRef.current) return;
        try {
          const status = await soundRef.current?.getStatusAsync();
          if (status && status.isLoaded && !status.isPlaying && status.didJustFinish) {
            setIsPlaying(false);
            if (statusIntervalRef.current) clearInterval(statusIntervalRef.current);
          }
        } catch (e) {}
      }, 500);
    } catch (e) {
      console.error('[SongBar] playback error:', e);
    }
  }, [isPlaying, song.s3Url]);

  const isDark = theme.colors.background === '#000000' || theme.colors.background === '#111114';
  const currentDuration = endTime - startTime;
  const is30 = currentDuration <= 30;

  const toggleDuration = (dur: number) => {
    const clamped = Math.min(dur, songDuration);
    onTrimChange(0, clamped);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#f0f0f0' }]}>
      <View style={styles.songInfoRow}>
        {/* Song artwork / icon */}
        <View style={[styles.artworkContainer, { backgroundColor: theme.colors.primary + '20' }]}>
          {song.thumbnailUrl || song.imageUrl ? (
            <Image
              source={{ uri: song.thumbnailUrl || song.imageUrl }}
              style={styles.artwork}
            />
          ) : (
            <GradientIonicon name="musical-notes" size={18} />
          )}
        </View>

        {/* Song title & artist */}
        <View style={styles.songTextContainer}>
          <Text style={[styles.songTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {song.title}
          </Text>
          <Text style={[styles.songArtist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {song.artist}
          </Text>
        </View>

        {/* Duration toggle: 30s / 60s */}
        <View style={styles.durationToggle}>
          <TouchableOpacity
            style={styles.durationChip}
            onPress={() => toggleDuration(30)}
            activeOpacity={0.7}
          >
            {is30 && (
              <LinearGradient
                colors={BLUE_ICON_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Text style={[styles.durationChipText, { color: is30 ? '#fff' : theme.colors.textSecondary }]}>30s</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.durationChip}
            onPress={() => toggleDuration(60)}
            activeOpacity={0.7}
          >
            {!is30 && (
              <LinearGradient
                colors={BLUE_ICON_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
            )}
            <Text style={[styles.durationChipText, { color: !is30 ? '#fff' : theme.colors.textSecondary }]}>60s</Text>
          </TouchableOpacity>
        </View>

        {/* Play/Pause */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlay}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={BLUE_ICON_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="white" />
        </TouchableOpacity>

        {/* Change */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: isDark ? '#2a2a2a' : '#e0e0e0', marginLeft: 6 }]}
          onPress={onOpenSelector}
          activeOpacity={0.7}
        >
          <GradientIonicon name="swap-horizontal" size={14} />
        </TouchableOpacity>

        {/* Remove */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#ff3b3020', marginLeft: 4 }]}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={14} color="#ff3b30" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  songInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  artworkContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  songTextContainer: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  songTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  songArtist: {
    fontSize: 12,
    fontWeight: '400',
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  durationToggle: {
    flexDirection: 'row',
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 8,
  },
  durationChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  durationChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SongBar;
