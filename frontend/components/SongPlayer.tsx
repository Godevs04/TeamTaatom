import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useTheme } from '../context/ThemeContext';
import { PostType } from '../types/post';
import logger from '../utils/logger';
import { audioManager } from '../utils/audioManager';

interface SongPlayerProps {
  post: PostType;
  isVisible?: boolean;
  autoPlay?: boolean;
  showPlayPause?: boolean; // Show play/pause button (for home page)
}

export default function SongPlayer({ post, isVisible = true, autoPlay = false, showPlayPause = false }: SongPlayerProps) {
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
  const endTime = post.song?.endTime || null;
  const volume = post.song?.volume || 0.5;

  // Debug: Log song data
  useEffect(() => {
    if (post.song) {
      logger.debug('SongPlayer - Post song data:', {
        hasSong: !!post.song,
        hasSongId: !!post.song.songId,
        songId: post.song.songId,
        s3Url: post.song.songId?.s3Url,
        title: post.song.songId?.title,
        artist: post.song.songId?.artist,
      });
    }
  }, [post.song]);

  // Audio mode is now set globally in _layout.tsx

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
        setSound(null);
        setIsPlaying(false);
      }
      // Audio manager handles cleanup automatically via stopAll()
      isInitializedRef.current = false;
    };
  }, [post._id]);

  // Helper function to fetch fresh signed URL if needed
  const fetchFreshSignedUrl = useCallback(async (): Promise<string | null> => {
    if (!song?._id) return null;
    
    try {
      const { getSongById } = await import('../services/songs');
      const freshSong = await getSongById(song._id);
      return freshSong.s3Url || (freshSong as any).cloudinaryUrl || null;
    } catch (error) {
      logger.error('Failed to fetch fresh signed URL:', error);
      return null;
    }
  }, [song?._id]);

  const loadAndPlaySong = useCallback(async (forcePlay: boolean = false, retryCount: number = 0) => {
    // Get audio URL - try s3Url first, then cloudinaryUrl as fallback
    let audioUrlRaw = song?.s3Url || (song as any)?.cloudinaryUrl;
    
    if (!audioUrlRaw) {
      logger.debug('No song URL available', { song });
      return;
    }

    try {
      setIsLoading(true);
      
      // Cleanup old sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {
          // Ignore errors during cleanup
        }
        soundRef.current = null;
      }

      // Clean and validate URL
      let audioUrl = audioUrlRaw.trim();
      if (!audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
        logger.error('Invalid audio URL:', audioUrl);
        throw new Error('Invalid audio URL format');
      }

      logger.debug('🎵 Playing audio URL:', audioUrl);
      logger.debug('   URL starts with https:', audioUrl.startsWith('https://'));
      logger.debug('   URL length:', audioUrl.length);

      // Determine if we should play immediately
      const shouldPlayNow = forcePlay || autoPlay;

      // 🔴 CRITICAL: Use streaming pattern (no download, no timeout waiting)
      const newSound = new Audio.Sound();

      // Load with streaming - shouldPlay triggers immediate streaming
      await newSound.loadAsync(
        { uri: audioUrl },
        {
          shouldPlay: shouldPlayNow, // Stream and play immediately
          progressUpdateIntervalMillis: 500,
          isLooping: true,
          volume: isMuted ? 0 : volume,
          positionMillis: startTime * 1000,
        },
        false // 🔴 MUST be false (no preload blocking - enables streaming)
      );

      soundRef.current = newSound;
      setSound(newSound);
      
      // Use audioManager.playSound to ensure previous audio stops (only if we're going to play)
      if (shouldPlayNow && post._id) {
        await audioManager.playSound(newSound, post._id.toString());
      }
      
      // Set up playback status listener
      newSound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setIsLoading(false);
          
          // Handle 60-second loop if endTime is set
          if (endTime && status.positionMillis >= endTime * 1000) {
            newSound.setPositionAsync(startTime * 1000).catch(() => {});
          } else if (status.didJustFinish && !status.isLooping) {
            if (startTime > 0) {
              newSound.setPositionAsync(startTime * 1000).catch(() => {});
              newSound.playAsync().catch(() => {});
            } else {
              newSound.replayAsync().catch(() => {});
            }
          }
        } else if (status.error) {
          logger.error('Playback error:', status.error);
          setIsLoading(false);
        }
      });

      setIsLoading(false);
      if (shouldPlayNow) {
        setIsPlaying(true);
      }
      
      logger.debug('✅ Audio streaming started successfully');
    } catch (error: any) {
      logger.error('❌ Error loading song:', error);
      setIsLoading(false);
      setIsPlaying(false);
      
      // Handle signed URL expiry - retry once with fresh URL
      const errorMessage = typeof error === 'string' ? error : error?.message || '';
      const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('60');
      const is403 = errorMessage.includes('403') || errorMessage.includes('Forbidden');
      const isExpired = errorMessage.includes('expired') || errorMessage.includes('ExpiredRequest');
      
      if ((isTimeout || is403 || isExpired) && retryCount === 0) {
        logger.debug('🔄 URL may be expired, fetching fresh URL and retrying...');
        const freshUrl = await fetchFreshSignedUrl();
        if (freshUrl) {
          // Update song object with fresh URL
          if (song) {
            (song as any).s3Url = freshUrl;
            (song as any).cloudinaryUrl = freshUrl;
          }
          // Retry once with fresh URL
          return loadAndPlaySong(forcePlay, 1);
        }
      }
      
      // Log error details for debugging
      logger.error('🔍 Error Details:', {
        message: errorMessage,
        code: (error as any)?.code,
        url: audioUrlRaw
      });
      
      throw error;
    }
  }, [song?.s3Url, autoPlay, isMuted, volume, startTime, endTime]);

  // Auto-play when component becomes visible and autoPlay is true (for shorts and home page)
  // For home page (showPlayPause=true), don't auto-play
  useEffect(() => {
    // For shorts and home page: sync with visibility and autoPlay prop
    const audioUrl = song?.s3Url || (song as any)?.cloudinaryUrl;
    if (isVisible && !showPlayPause && audioUrl) {
      if (autoPlay) {
        // Should play - play song
        const currentPostId = audioManager.getCurrentPostId();
        
        // Critical check: If soundRef exists but audioManager has no current sound,
        // it means stopAll() was called and the sound was unloaded externally.
        // We need to clear soundRef and reload.
        if (soundRef.current && currentPostId === null) {
          // Sound was stopped externally (e.g., via stopAll when muting)
          // Clear the ref and reload
          logger.debug('Sound was unloaded externally (likely after mute), clearing ref and reloading');
          soundRef.current = null;
          setSound(null);
          loadAndPlaySong()
            .then(() => {
              setIsPlaying(true);
            })
            .catch((err) => {
              logger.error('Error reloading and playing sound after external stop:', err);
            });
          return;
        }
        
        if (!soundRef.current) {
          // Load and play if not already loaded
          loadAndPlaySong();
        } else {
          // If already loaded, check if it's already playing
          
          if (post._id && currentPostId !== post._id.toString()) {
            // Different post is playing, use audioManager to switch
            audioManager.playSound(soundRef.current, post._id.toString())
              .then(() => {
                setIsPlaying(true);
              })
              .catch((err) => {
                logger.error('Error playing sound:', err);
                // If playSound fails (e.g., sound was unloaded), reload
                soundRef.current = null;
                setSound(null);
                loadAndPlaySong();
              });
          } else if (post._id && currentPostId === post._id.toString()) {
            // Same post - check if sound is actually playing, if not, resume it
            soundRef.current.getStatusAsync()
              .then((status) => {
                if (status.isLoaded && !status.isPlaying) {
                  // Sound is loaded but paused, resume it
                  soundRef.current?.playAsync()
                    .then(() => {
                      setIsPlaying(true);
                    })
                    .catch((err) => {
                      logger.error('Error resuming sound:', err);
                    });
                } else {
                  // Already playing, just update state
                  setIsPlaying(true);
                }
              })
              .catch(() => {
                // If status check fails, the sound might be unloaded (e.g., after stopAll)
                // Reload and play the song - this is critical for unmuting
                logger.debug('Sound status check failed, reloading song (likely after unmute)');
                soundRef.current = null;
                setSound(null);
                loadAndPlaySong()
                  .then(() => {
                    setIsPlaying(true);
                  })
                  .catch((err) => {
                    logger.error('Error reloading and playing sound:', err);
                  });
              });
          } else {
            // Post is not currently playing - need to load and play
            // This can happen when unmuting a post that was stopped
            logger.debug('Post not currently playing, loading and playing (likely after unmute)');
            loadAndPlaySong()
              .then(() => {
                setIsPlaying(true);
              })
              .catch((err) => {
                logger.error('Error loading and playing sound:', err);
              });
          }
        }
      } else {
        // autoPlay is false - pause song immediately (muted or not visible)
        if (soundRef.current) {
          soundRef.current.pauseAsync().catch(err => {
            logger.error('Error pausing:', err);
          });
          setIsPlaying(false);
        }
      }
    }

    // Stop and unload when component becomes invisible (only for auto-play mode)
    if (!isVisible && !showPlayPause && soundRef.current) {
      // Stop + unload instantly to prevent audio bleeding
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
      setSound(null);
      setIsPlaying(false);
    }
  }, [isVisible, autoPlay, showPlayPause, song?.s3Url, loadAndPlaySong, post._id]);

  const togglePlayPause = useCallback(async () => {
    logger.debug('Toggle play/pause - soundRef exists:', !!soundRef.current);
    
    if (!soundRef.current) {
      logger.debug('No sound loaded, loading and playing...');
      await loadAndPlaySong(true); // Force play when user clicks play button
      return;
    }

    try {
      const status = await soundRef.current.getStatusAsync();
      logger.debug('Current playback status:', status);
      
      if (status.isLoaded) {
        const isCurrentlyPlaying = 'isPlaying' in status && status.isPlaying;
        if (isCurrentlyPlaying) {
          logger.debug('Pausing playback...');
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          logger.debug('Starting playback...');
          // Use audioManager.playSound to ensure previous audio stops
          if (post._id) {
            await audioManager.playSound(soundRef.current, post._id.toString());
          }
          // Ensure volume is set correctly - check status first to avoid errors
          try {
            const currentStatus = await soundRef.current.getStatusAsync();
            if (currentStatus.isLoaded) {
              await soundRef.current.setVolumeAsync(isMuted ? 0 : volume);
            } else {
              logger.warn('Sound not loaded when setting volume, skipping volume update');
            }
          } catch (volumeError) {
            logger.warn('Error setting volume (non-critical):', volumeError);
            // Non-critical error, continue with playback
          }
          setIsPlaying(true);
          logger.debug('Playback started');
        }
      } else {
        logger.error('Sound status error, reloading:', status);
        // If there's an error, reload the sound
        await loadAndPlaySong(true);
      }
    } catch (error) {
      logger.error('Error toggling playback:', error);
      // On error, try to reload and play
      try {
        await loadAndPlaySong(true);
      } catch (reloadError) {
        logger.error('Error reloading song:', reloadError);
      }
    }
  }, [loadAndPlaySong, isMuted, volume]);

  const toggleMute = useCallback(async () => {
    if (!soundRef.current) return;

    try {
      // Check if sound is loaded before attempting to set volume
      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        logger.warn('Cannot toggle mute: sound is not loaded');
        return;
      }

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
      logger.error('Error toggling mute:', error);
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
        logger.error('Error stopping song:', error);
      }
    }
  }, []);

  // Don't render if no song
  if (!song) {
    return null;
  }

  // Check if song has required data - try s3Url first, then cloudinaryUrl as fallback
  const audioUrl = song?.s3Url || (song as any)?.cloudinaryUrl;
  if (!audioUrl) {
    logger.warn('SongPlayer: Song missing audio URL', song);
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: showPlayPause 
        ? 'rgba(0, 0, 0, 0.25)' // More transparent for home page (glass effect)
        : 'rgba(0, 0, 0, 0.4)', // Less transparent for shorts
      borderRadius: 25,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 0,
      minHeight: 44,
      zIndex: 1000,
      width: '100%',
      borderWidth: 1,
      borderColor: showPlayPause 
        ? 'rgba(255, 255, 255, 0.25)' // Lighter border for glass effect
        : 'rgba(255, 255, 255, 0.15)',
      // Glass effect shadows
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: showPlayPause ? 0.15 : 0.2,
      shadowRadius: showPlayPause ? 8 : 6,
      elevation: showPlayPause ? 3 : 5,
    },
    songInfo: {
      flex: 1,
      marginLeft: 10,
    },
    songTitle: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    songArtist: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: 11,
      marginTop: 2,
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
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
      {/* Play/Pause Button (for home page) or Music Icon (for shorts) */}
      {showPlayPause ? (
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => {
            logger.debug('Play/Pause button pressed');
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
      ) : (
        <View style={styles.controlButton}>
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
              name="musical-notes"
              size={18}
              color="#fff"
            />
          )}
        </View>
      )}

      {/* Song Info */}
      <View style={styles.songInfo} pointerEvents="none">
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title || 'Unknown Song'}
        </Text>
        <Text style={styles.songArtist} numberOfLines={1}>
          {song.artist || 'Unknown Artist'}
        </Text>
      </View>

      {/* Mute/Unmute Button */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={() => {
          logger.debug('Mute button pressed');
          toggleMute();
        }}
        disabled={!soundRef.current && !isLoading}
        activeOpacity={0.7}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          <Ionicons
            name={isMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color="#fff"
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

