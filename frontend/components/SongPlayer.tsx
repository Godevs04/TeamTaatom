import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';

interface SongPlayerProps {
  post: PostType;
  isVisible?: boolean;
  autoPlay?: boolean;
}

export default function SongPlayer({ post, isVisible = true, autoPlay = false }: SongPlayerProps) {
  const { theme } = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const soundRef = useRef<Audio.Sound | null>(null);
  const isInitializedRef = useRef(false);

  // Get song data from post
  const song = post.song?.songId;
  const startTime = post.song?.startTime || 0;
  const volume = post.song?.volume || 0.5;

  // Debug: Log song data
  useEffect(() => {
    if (post.song) {
      console.log('SongPlayer - Post song data:', {
        hasSong: !!post.song,
        hasSongId: !!post.song.songId,
        songId: post.song.songId,
        s3Url: post.song.songId?.s3Url,
        title: post.song.songId?.title,
        artist: post.song.songId?.artist,
      });
    }
  }, [post.song]);

  // Initialize audio mode once
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    }).catch(err => console.error('Error setting audio mode:', err));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
    };
  }, []);

  const loadAndPlaySong = useCallback(async () => {
    if (!song?.s3Url) {
      console.log('No song URL available');
      return;
    }

    try {
      setIsLoading(true);
      
      // Stop and unload existing sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore errors during cleanup
        }
        soundRef.current = null;
      }

      console.log('Loading song:', song.s3Url);

      // Clean and validate URL
      let audioUrl = song.s3Url.trim();
      // Ensure URL is properly formatted
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
        console.error('Invalid audio URL:', audioUrl);
        throw new Error('Invalid audio URL format');
      }

      console.log('Attempting to load audio from:', audioUrl);

      // Load new sound with proper error handling
      // Note: expo-av doesn't support custom headers in the source object
      // CloudFront CORS must be configured on the server side
      const { sound: newSound } = await Audio.Sound.createAsync(
        { 
          uri: audioUrl,
        },
        {
          shouldPlay: autoPlay,
          isLooping: true,
          volume: isMuted ? 0 : volume,
          positionMillis: startTime * 1000, // Convert seconds to milliseconds
        },
        (status) => {
          // Immediate status callback
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            setIsLoading(false);
            console.log('Audio loaded successfully');
          } else if (status.error) {
            console.error('Playback status error:', status.error);
            setIsLoading(false);
          }
        }
      );

      soundRef.current = newSound;
      setSound(newSound);
      setIsPlaying(autoPlay);
      setIsLoading(false);

      // Set up playback status listener
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setIsLoading(false);
          if (status.didJustFinish && !status.isLooping) {
            // Restart if looping
            newSound.replayAsync().catch(() => {});
          }
        } else if (status.error) {
          console.error('Playback error:', status.error);
          setIsLoading(false);
          // Try to provide more helpful error message
          const errorObj = status.error as any;
          const errorMsg = typeof errorObj === 'string' ? errorObj : errorObj?.message || '';
          const errorCode = errorObj?.code;
          if (errorMsg.includes('-1102') || errorCode === -1102) {
            console.error('Audio file not accessible. This may be a CloudFront CORS or access issue.');
            console.error('Please check:');
            console.error('1. CloudFront CORS configuration');
            console.error('2. CloudFront OAC (Origin Access Control) settings');
            console.error('3. The file exists at:', song.s3Url);
          }
        }
      });
    } catch (error: any) {
      console.error('Error loading song:', error);
      setIsLoading(false);
      
      // Provide more helpful error messages
      const errorMessage = typeof error === 'string' ? error : error?.message || '';
      const errorCode = (error as any)?.code;
      if (errorMessage.includes('-1102') || errorCode === -1102) {
        console.error('❌ NSURLErrorDomain -1102: Audio file not accessible');
        console.error('This error typically means the audio file cannot be accessed from the app.');
        console.error('');
        console.error('🔧 REQUIRED CLOUDFRONT CONFIGURATION:');
        console.error('1. CloudFront Distribution must have CORS headers configured');
        console.error('   - Add CORS policy to CloudFront response headers');
        console.error('   - Allow Origin: * (or your app domain)');
        console.error('   - Allow Methods: GET, HEAD, OPTIONS');
        console.error('   - Allow Headers: Range, Accept, Content-Type');
        console.error('');
        console.error('2. If using private S3 bucket with OAC:');
        console.error('   - Ensure CloudFront OAC is properly configured');
        console.error('   - Verify CloudFront has permission to access S3 bucket');
        console.error('');
        console.error('3. Verify the file exists at the URL:');
        console.error('   URL:', song.s3Url);
        console.error('');
        console.error('💡 To test: Open the URL in a browser to see if it loads');
      } else {
        console.error('Error loading song:', error);
      }
    }
  }, [song?.s3Url, autoPlay, isMuted, volume, startTime]);

  // Auto-play when component becomes visible and autoPlay is true
  useEffect(() => {
    if (isVisible && autoPlay && song?.s3Url && !isInitializedRef.current) {
      isInitializedRef.current = true;
      loadAndPlaySong();
    }

    // Cleanup when component becomes invisible
    if (!isVisible && soundRef.current) {
      const cleanup = async () => {
        if (soundRef.current) {
          try {
            await soundRef.current.stopAsync();
            await soundRef.current.unloadAsync();
            soundRef.current = null;
            setSound(null);
            setIsPlaying(false);
          } catch (error) {
            console.error('Error stopping song:', error);
          }
        }
        isInitializedRef.current = false;
      };
      cleanup();
    }
  }, [isVisible, autoPlay, song?.s3Url, loadAndPlaySong]);

  const togglePlayPause = useCallback(async () => {
    if (!soundRef.current) {
      await loadAndPlaySong();
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        if (status.isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  }, [loadAndPlaySong]);

  const toggleMute = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      const newMutedState = !isMuted;
      await soundRef.current.setVolumeAsync(newMutedState ? 0 : volume);
      setIsMuted(newMutedState);

      // Animate mute icon
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  }, [isMuted, volume, fadeAnim]);

  const stopSong = useCallback(async () => {
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
        setSound(null);
        setIsPlaying(false);
      } catch (error) {
        console.error('Error stopping song:', error);
      }
    }
  }, []);

  // Don't render if no song
  if (!song) {
    return null;
  }

  // Check if song has required data
  if (!song.s3Url) {
    console.warn('SongPlayer: Song missing s3Url', song);
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: 20,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginTop: 8,
      minHeight: 40,
      zIndex: 1000,
    },
    songInfo: {
      flex: 1,
      marginLeft: 8,
    },
    songTitle: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '600',
    },
    songArtist: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: 10,
      marginTop: 2,
    },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: 8,
    },
    controlButton: {
      padding: 8,
      marginLeft: 4,
      minWidth: 36,
      minHeight: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingContainer: {
      width: 16,
      height: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => {
          console.log('Play/Pause button pressed');
          togglePlayPause();
        }}
        disabled={isLoading}
        activeOpacity={0.7}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Animated.View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: '#fff',
                opacity: fadeAnim,
              }}
            />
          </View>
        ) : (
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={18}
            color="#fff"
          />
        )}
      </TouchableOpacity>

      <View style={styles.songInfo} pointerEvents="none">
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title || 'Unknown Song'}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {song.artist || 'Unknown Artist'}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => {
          console.log('Mute button pressed');
          toggleMute();
        }}
        disabled={!soundRef.current}
        activeOpacity={0.7}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={18}
            color="#fff"
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

